import { performance } from "node:perf_hooks";

import type { Pool, PoolClient } from "pg";
import { z } from "zod";

/**
 * `pnpm --filter @workspace/api db:security-benchmark`: how much the permission-level row-level security (ADR 090)
 * costs at volume. In a throwaway database (every migration and the security SQL), one tenant gets `--rows` sales and a
 * tenth as many rewards; each query then runs as the superuser (no RLS) and as a member under RLS (the role check
 * `app_has_permission` on every row), and the medians are compared. `--max-overhead` makes it fail above a ratio.
 */

/** What a benchmark run measures. */
export interface BenchmarkOptions {
	readonly rows: number;
	readonly runs: number;
	/** Fail when a query under RLS is slower than this many times the superuser's (absent: report only). */
	readonly maxOverhead: number | undefined;
}

const DEFAULT_ROWS = 100_000;
const DEFAULT_RUNS = 5;
/** Rewards per sale in the generated data (one reward for every ten sales). */
const SALES_PER_REWARD = 10;

const PositiveIntSchema = z.coerce.number().int().positive();
const PositiveRatioSchema = z.coerce.number().positive();

function flagValue(args: readonly string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index === -1 ? undefined : args.at(index + 1);
}

/** Parses `[--rows N] [--runs N] [--max-overhead X]`. */
export function parseBenchmarkOptions(args: readonly string[]): BenchmarkOptions {
	const rows = flagValue(args, "--rows");
	const runs = flagValue(args, "--runs");
	const maxOverhead = flagValue(args, "--max-overhead");
	return {
		rows: rows === undefined ? DEFAULT_ROWS : PositiveIntSchema.parse(rows),
		runs: runs === undefined ? DEFAULT_RUNS : PositiveIntSchema.parse(runs),
		maxOverhead: maxOverhead === undefined ? undefined : PositiveRatioSchema.parse(maxOverhead),
	};
}

/** The generated tenant, its member and their store. */
export const BENCHMARK_IDS = Object.freeze({
	tenant: "019b76da-b000-7000-8000-000000000001",
	member: "019b76da-b000-7000-8000-000000000002",
	customer: "019b76da-b000-7000-8000-000000000003",
	location: "019b76da-b000-7000-8000-000000000004",
	role: "019b76da-b000-7000-8000-000000000005",
	membership: "019b76da-b000-7000-8000-000000000006",
	scope: "019b76da-b000-7000-8000-000000000007",
});

/** The data: a tenant, a member whose role holds analytics.read and reward.read, `rows` sales and a tenth as many rewards. */
export function benchmarkFixtureSql(rows: number): string {
	const ids = BENCHMARK_IDS;
	const rewards = Math.max(1, Math.floor(rows / SALES_PER_REWARD));
	return `
INSERT INTO public."Permission" (id, resource, action, scope) VALUES
  (gen_random_uuid(), 'ANALYTICS', 'READ', 'GLOBAL'), (gen_random_uuid(), 'REWARD', 'READ', 'GLOBAL')
  ON CONFLICT DO NOTHING;
INSERT INTO public."User" (id, "fullName", email, "passwordHash") VALUES
  ('${ids.member}', 'Benchmark member', 'benchmark-member@example.com', 'x'),
  ('${ids.customer}', 'Benchmark customer', 'benchmark-customer@example.com', 'x');
INSERT INTO public."Tenant" (id, slug, "displayName") VALUES ('${ids.tenant}', 'benchmark', 'Benchmark');
INSERT INTO public."Location" (id, "tenantId", name, code) VALUES ('${ids.location}', '${ids.tenant}', 'Benchmark store', 'bench');
INSERT INTO public."Role" (id, name, kind, "tenantId") VALUES ('${ids.role}', 'Benchmark analyst', 'TENANT', '${ids.tenant}');
INSERT INTO public."RolePermission" (id, "roleId", "permissionId")
  SELECT gen_random_uuid(), '${ids.role}', p.id FROM public."Permission" p
  WHERE p.scope = 'GLOBAL' AND (p.resource, p.action) IN (('ANALYTICS', 'READ'), ('REWARD', 'READ'));
INSERT INTO public."Membership" (id, "tenantId", "userId", "roleId", role) VALUES ('${ids.membership}', '${ids.tenant}', '${ids.member}', '${ids.role}', 'MANAGER');
INSERT INTO public."MembershipLocationScope" (id, "tenantId", "membershipId", "scopeType") VALUES ('${ids.scope}', '${ids.tenant}', '${ids.membership}', 'ALL_LOCATIONS');
INSERT INTO public."RewardSale" (id, "tenantId", "locationId", "userId", "terminalId", "billTotalMinor", currency, "idempotencyKey", "requestHash", "paidAt")
  SELECT gen_random_uuid(), '${ids.tenant}', '${ids.location}', '${ids.customer}', 'BENCH', 1000, 'MYR', 'bench-' || n, 'bench', n
  FROM generate_series(1, ${String(rows)}) AS n;
INSERT INTO public."Reward" (id, "tenantId", title, description, "rewardType", category, "quantityTotal", "quantityRemaining", "expiryDate")
  SELECT gen_random_uuid(), '${ids.tenant}', 'Reward ' || n, 'Benchmark', 'DISCOUNT', 'bench', 1, 1, 4102444800000
  FROM generate_series(1, ${String(rewards)}) AS n;
ANALYZE public."RewardSale";
ANALYZE public."Reward";
`;
}

/** One measured query. */
export interface BenchmarkQuery {
	readonly name: string;
	readonly sql: string;
}

export const BENCHMARK_QUERIES: readonly BenchmarkQuery[] = [
	{ name: "count the tenant's sales (analytics)", sql: `SELECT count(*) FROM public."RewardSale" WHERE "tenantId" = '${BENCHMARK_IDS.tenant}'` },
	{
		name: "newest 50 sales (a list page)",
		sql: `SELECT id FROM public."RewardSale" WHERE "tenantId" = '${BENCHMARK_IDS.tenant}' ORDER BY "paidAt" DESC LIMIT 50`,
	},
	{ name: "count the tenant's rewards", sql: `SELECT count(*) FROM public."Reward" WHERE "tenantId" = '${BENCHMARK_IDS.tenant}'` },
];

/** The middle value (the mean of the two middle values for an even count). */
export function median(values: readonly number[]): number {
	const sorted = [...values].sort((left: number, right: number): number => left - right);
	const middle = Math.floor(sorted.length / 2);
	const upper = sorted.at(middle) ?? 0;
	return sorted.length % 2 === 1 ? upper : ((sorted.at(middle - 1) ?? upper) + upper) / 2;
}

/** One query's result. */
export interface BenchmarkResult {
	readonly name: string;
	readonly superuserMs: number;
	readonly memberMs: number;
	/** How many times slower the member's query is. */
	readonly overhead: number;
	/** Rows the member's query returned (proves RLS let the member see the data, not an empty answer). */
	readonly memberRows: number;
}

async function timed(run: () => Promise<number>): Promise<{ readonly ms: number; readonly rows: number }> {
	const started = performance.now();
	const rows = await run();
	return { ms: performance.now() - started, rows };
}

/** Runs `sql` as the member, under row-level security, in its own transaction. */
async function asMember(client: PoolClient, sql: string): Promise<number> {
	await client.query("BEGIN");
	try {
		await client.query("SET LOCAL ROLE app_runtime");
		await client.query("SELECT set_config('app.rls_bypass', 'false', true), set_config('app.current_tenant_id', $1, true), set_config('app.current_user_id', $2, true)", [
			BENCHMARK_IDS.tenant,
			BENCHMARK_IDS.member,
		]);
		return (await client.query(sql)).rowCount ?? 0;
	} finally {
		await client.query("ROLLBACK");
	}
}

/** Measures every query `runs` times each way (after one warm-up of each) and returns the medians. */
export async function runBenchmark(pool: Pool, runs: number): Promise<BenchmarkResult[]> {
	const client = await pool.connect();
	try {
		const results: BenchmarkResult[] = [];
		for (const query of BENCHMARK_QUERIES) {
			await client.query(query.sql);
			await asMember(client, query.sql);
			const superuser: number[] = [];
			const member: number[] = [];
			let memberRows = 0;
			for (let run = 0; run < runs; run += 1) {
				superuser.push((await timed(async (): Promise<number> => (await client.query(query.sql)).rowCount ?? 0)).ms);
				const measured = await timed((): Promise<number> => asMember(client, query.sql));
				member.push(measured.ms);
				memberRows = measured.rows;
			}
			const superuserMs = median(superuser);
			const memberMs = median(member);
			results.push({ name: query.name, superuserMs, memberMs, overhead: superuserMs === 0 ? 0 : memberMs / superuserMs, memberRows });
		}
		return results;
	} finally {
		client.release();
	}
}

/** Two decimals for milliseconds and ratios. */
const DECIMALS = 2;

/** The results as a plain table. */
export function formatBenchmark(results: readonly BenchmarkResult[]): string {
	const lines = results.map(
		(result: BenchmarkResult): string =>
			`  ${result.name.padEnd(40)} superuser ${result.superuserMs.toFixed(DECIMALS)} ms · member (RLS) ${result.memberMs.toFixed(DECIMALS)} ms · ×${result.overhead.toFixed(DECIMALS)} · ${String(result.memberRows)} row(s)`,
	);
	return lines.join("\n");
}

/** The queries slower under RLS than `maxOverhead` times the superuser's. */
export function overBudget(results: readonly BenchmarkResult[], maxOverhead: number | undefined): BenchmarkResult[] {
	return maxOverhead === undefined ? [] : results.filter((result: BenchmarkResult): boolean => result.overhead > maxOverhead);
}
