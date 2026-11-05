import { AsyncLocalStorage } from "node:async_hooks";

import { isStringPrimitive } from "@workspace/shared";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";

/** One statement the API issued: its text and its bound values (so it can be EXPLAINed the same way). */
export interface RecordedStatement {
	readonly sql: string;
	readonly values: readonly BoundValue[];
}

/** One bound value as it can be sent again: a scalar, or an array of scalars (`= ANY($1)`). Dates and bigints travel as text. */
type BoundScalar = string | number | boolean | null;
type BoundValue = BoundScalar | readonly BoundScalar[];
const BoundScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null(), z.bigint().transform(String), z.instanceof(Date).transform((date) => date.toISOString())]);
const BoundValuesSchema = z.array(z.union([BoundScalarSchema, z.array(BoundScalarSchema)]));
/** `pg`'s query-config form, which Prisma's driver uses: the values travel inside it. */
const QueryTextSchema = z.object({ text: z.string() });
const QueryValuesSchema = z.object({ values: BoundValuesSchema });

/** The recording the current measured work writes into (requests started inside `record` inherit it). */
const recording = new AsyncLocalStorage<RecordedStatement[]>();

function remember(query: string | { readonly text: string }, values: readonly (string | number | boolean | null)[] | undefined): void {
	const into = recording.getStore();
	const sql = isStringPrimitive(query) ? query : QueryTextSchema.safeParse(query).data?.text;
	if (into === undefined || sql === undefined) {
		return;
	}
	const bound = values === undefined ? QueryValuesSchema.safeParse(query).data?.values : BoundValuesSchema.safeParse(values).data;
	into.push({ sql, values: bound ?? [] });
}

type QueryFunction = (query: string | { readonly text: string }, values?: readonly (string | number | boolean | null)[]) => Promise<object>;
const QueryFunctionSchema = z.custom<QueryFunction>((candidate) => candidate instanceof Function);

/** Clients already wrapped (a pooled client is handed out many times). */
const wrapped = new WeakSet<Pool | PoolClient>();

/** Wraps `target.query` so statements issued inside `record` are remembered (and still run). */
function wrapQuery(target: Pool | PoolClient): void {
	if (wrapped.has(target)) {
		return;
	}
	wrapped.add(target);
	const original = QueryFunctionSchema.parse(target.query).bind(target);
	Object.defineProperty(target, "query", {
		configurable: true,
		writable: true,
		value: (query: string | { readonly text: string }, values?: readonly (string | number | boolean | null)[]): Promise<object> => {
			remember(query, values);
			return original(query, values);
		},
	});
}

/**
 * Records every statement issued on `pool` (its own `query`, and every client it hands out, which is how
 * Prisma runs interactive transactions) while `run` executes. Background work started outside `run` is
 * not recorded. The pool is restored afterwards.
 */
export async function recordStatements(pool: Pool, run: () => Promise<void>): Promise<readonly RecordedStatement[]> {
	const statements: RecordedStatement[] = [];
	const originalConnect: () => Promise<PoolClient> = pool.connect.bind(pool);
	wrapQuery(pool);
	Object.defineProperty(pool, "connect", {
		configurable: true,
		writable: true,
		value: async (): Promise<PoolClient> => {
			const client = await originalConnect();
			wrapQuery(client);
			return client;
		},
	});
	try {
		await recording.run(statements, run);
		return statements;
	} finally {
		Reflect.deleteProperty(pool, "query");
		Reflect.deleteProperty(pool, "connect");
		wrapped.delete(pool);
	}
}
