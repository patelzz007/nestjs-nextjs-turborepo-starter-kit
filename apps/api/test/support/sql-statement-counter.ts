import { AsyncLocalStorage } from "node:async_hooks";

import { isStringPrimitive } from "@workspace/shared";
import { z } from "zod";
import { Pool, type QueryResult } from "pg";
import { expect } from "vitest";

/**
 * Infrastructure noise when counting how many SQL statements a handler issues.
 * Prisma and RLS setup emit these on every transaction; they are not page-size dependent.
 */
const IGNORED_STATEMENT_PATTERN =
	/^\s*(BEGIN(\s|$)|COMMIT(\s|$)|ROLLBACK(\s|$)|SAVEPOINT\s|RELEASE\s+SAVEPOINT\s|SET\s+ROLE\s|RESET(\s|$)|SELECT\s+set_config\s*\(|SET\s+LOCAL\s+statement_timeout)/i;

const QueryTextObjectSchema = z.object({ text: z.string() });

type QueryValues = readonly (string | number | boolean | null)[];

type PoolTextQuery = (query: string | { text: string }, values?: QueryValues) => Promise<QueryResult>;

function sqlTextFromQueryArgs(query: string | { text: string }): string | null {
	if (isStringPrimitive(query)) {
		return query;
	}
	const parsed = QueryTextObjectSchema.safeParse(query);
	if (!parsed.success) {
		return null;
	}
	return parsed.data.text.length > 0 ? parsed.data.text : null;
}

function shouldIgnoreStatement(sql: string): boolean {
	return IGNORED_STATEMENT_PATTERN.test(sql);
}

const NativePoolQuerySchema = z.custom<PoolTextQuery>((candidate) => candidate instanceof Function);
const PrototypeSchema = z.custom<object>((candidate) => candidate instanceof Object);

/** `pg` exports `BoundPool`, whose own prototype does not define `query`. */
function nativePoolQuery(): PoolTextQuery {
	let owner: object | null = Pool.prototype;
	while (owner !== null && owner !== Object.prototype) {
		const parsed = NativePoolQuerySchema.safeParse(Object.getOwnPropertyDescriptor(owner, "query")?.value);
		if (parsed.success) {
			return parsed.data;
		}
		const parent = PrototypeSchema.safeParse(Object.getPrototypeOf(owner));
		owner = parent.success ? parent.data : null;
	}
	throw new Error("Pool.prototype.query is not callable.");
}

const invokeNativePoolQueryMethod = nativePoolQuery();

/** Invokes the original `Pool#query` so a patched instance property does not recurse. */
function invokeNativePoolQuery(pool: Pool, query: string | { text: string }, values?: QueryValues): Promise<QueryResult> {
	return invokeNativePoolQueryMethod.call(pool, query, values);
}

export interface StatementCounterHandle {
	readonly count: () => number;
	/** Runs `run` as measured work: only the statements it issues (and the work it awaits) are counted. */
	readonly measure: (run: () => Promise<void>) => Promise<void>;
	readonly detach: () => void;
}

/** One counter's running total. */
interface StatementTally {
	counted: number;
}

/**
 * The measured work's async context. A statement counts only when it is issued inside the work being
 * measured — an in-process request (`app.inject`) inherits the context, while the app's own background
 * timers (sweeps, retention intervals) started at boot do not, so their statements never leak into a count.
 */
const measuredWork = new AsyncLocalStorage<StatementTally>();

/** Attaches a statement counter to one pool instance (does not affect other pools). */
export function attachStatementCounter(pool: Pool): StatementCounterHandle {
	const tally: StatementTally = { counted: 0 };
	const patched: PoolTextQuery = (query, values): Promise<QueryResult> => {
		const sql = sqlTextFromQueryArgs(query);
		if (sql !== null && !shouldIgnoreStatement(sql) && measuredWork.getStore() === tally) {
			tally.counted += 1;
		}
		return invokeNativePoolQuery(pool, query, values);
	};
	Object.defineProperty(pool, "query", { configurable: true, writable: true, value: patched });
	return {
		count: (): number => tally.counted,
		measure: (run: () => Promise<void>): Promise<void> => measuredWork.run(tally, run),
		detach: (): void => {
			Reflect.deleteProperty(pool, "query");
		},
	};
}

/** Counts SQL statements `run` issues on `pool` (real queries still execute; other work on the pool is not counted). */
export async function countStatements(pool: Pool, run: () => Promise<void>): Promise<number> {
	const counter = attachStatementCounter(pool);
	try {
		await counter.measure(run);
		return counter.count();
	} finally {
		counter.detach();
	}
}

/**
 * Asserts list endpoints issue a fixed number of SQL statements regardless of page size
 * (1-row page vs 25-row page).
 */
export async function expectNoNPlusOne(pool: Pool, request: (pageSize: number) => Promise<void>, seed: (rows: number) => Promise<void>): Promise<void> {
	await seed(1);
	const singleRowCount = await countStatements(pool, () => request(1));
	await seed(25);
	const fullPageCount = await countStatements(pool, () => request(25));
	expect(fullPageCount).toBe(singleRowCount);
}
