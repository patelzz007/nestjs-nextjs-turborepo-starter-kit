import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { z } from "zod";

import {
	buildDataChangeCaptureSql,
	DATA_CHANGE_ROW_TRIGGER,
	DATA_CHANGE_TRUNCATE_TRIGGER,
	planDataChangeCapture,
	PRISMA_MIGRATIONS_TABLE,
	type DataChangeCatalogTable,
	type DataChangeCapturePlan,
} from "../prisma/rls/data-change-capture.js";
import { APP_RUNTIME_ROLE, buildWithheldPrivilegeRevocationSql, listWithheldPrivileges, type WithheldPrivilegeEntry } from "../prisma/rls/withheld-privileges.js";
import { buildRlsApplyPlan } from "./rls-apply-plan.js";

const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = resolve(apiDir, ".env");

function getDatabaseUrl(): string {
	const fromEnv = process.env.DATABASE_URL?.trim();
	if (fromEnv !== undefined && fromEnv.length > 0) {
		return fromEnv;
	}

	if (!existsSync(envFile)) {
		throw new Error(`DATABASE_URL is not set and .env was not found at ${envFile}`);
	}

	const envContent = readFileSync(envFile, "utf8");

	const databaseUrlLine = envContent.split(/\r?\n/).find((line: string) => line.trim().startsWith("DATABASE_URL="));

	if (databaseUrlLine === undefined) {
		throw new Error(`DATABASE_URL was not found inside ${envFile}`);
	}

	let value = databaseUrlLine.slice(databaseUrlLine.indexOf("=") + 1).trim();

	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
		value = value.slice(1, -1);
	}

	return value;
}

function stripPrismaQueryParams(databaseUrl: string): string {
	const questionMarkIndex = databaseUrl.indexOf("?");

	if (questionMarkIndex === -1) {
		return databaseUrl;
	}

	return databaseUrl.slice(0, questionMarkIndex);
}

/** Deadlock (`40P01`) and lock-timeout (`55P03`) are transient when another session holds table locks. */
const RETRYABLE_SQLSTATES: ReadonlySet<string> = new Set(["40P01", "55P03"]);
const MAX_ATTEMPTS = 6;
const LOCK_TIMEOUT = "10s";

const PgErrorSchema = z.object({ code: z.string(), message: z.string() });

function readRetryableError(error: Error): string | null {
	const parsed = PgErrorSchema.safeParse(error);
	return parsed.success && RETRYABLE_SQLSTATES.has(parsed.data.code) ? parsed.data.message : null;
}

async function delay(ms: number): Promise<void> {
	await new Promise<void>((resolveDelay) => {
		setTimeout(resolveDelay, ms);
	});
}

/**
 * Apply one SQL file atomically on a dedicated connection.
 *
 * `ALTER TABLE … ENABLE ROW LEVEL SECURITY` / `CREATE POLICY` take ACCESS
 * EXCLUSIVE locks table by table. A concurrently running API (queue workers,
 * cron jobs, Prisma Studio) touching the same tables in another order can
 * deadlock with it. The file runs in one explicit transaction with a bounded
 * lock wait; on a deadlock or lock timeout the whole transaction rolls back,
 * so retrying the (idempotent) file is safe.
 */
async function runSqlInTransaction(pool: Pool, sql: string): Promise<void> {
	for (let attempt = 1; ; attempt += 1) {
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			await client.query(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`);
			await client.query(sql);
			await client.query("COMMIT");
			return;
		} catch (error) {
			await client.query("ROLLBACK");
			const retryable = error instanceof Error ? readRetryableError(error) : null;
			if (retryable === null || attempt >= MAX_ATTEMPTS) {
				throw error;
			}
			const backoffMs = 500 * 2 ** (attempt - 1);
			console.warn(
				`    ${retryable} — retrying in ${String(backoffMs)}ms (attempt ${String(attempt + 1)}/${String(MAX_ATTEMPTS)}). Stop the running API to avoid lock contention.`,
			);
			await delay(backoffMs);
		} finally {
			client.release();
		}
	}
}

/** The grants file the plan runs last; the withheld-privilege REVOKEs must follow its blanket grant. */
const APP_RUNTIME_GRANTS_FILE = "99-app-runtime-grants.sql";

/**
 * The SQL of one plan file. The final file (the `app_runtime` grants) gets the
 * generated withheld-privilege REVOKEs appended, so they commit in the SAME
 * transaction as the blanket grant — there is never a committed state in which
 * an append-only table is writable again.
 */
function sqlForPlanFile(sqlFile: string, isLast: boolean, withheld: readonly WithheldPrivilegeEntry[]): string {
	const sql = readFileSync(sqlFile, "utf8");
	if (!isLast) {
		return sql;
	}
	if (!sqlFile.endsWith(APP_RUNTIME_GRANTS_FILE)) {
		throw new Error(`The RLS plan must end with ${APP_RUNTIME_GRANTS_FILE} (withheld privileges are revoked after its blanket grant); it ends with ${sqlFile}`);
	}
	return `${sql}\n${buildWithheldPrivilegeRevocationSql(withheld)}\n`;
}

const PrivilegeRowSchema = z.object({ table: z.string(), privilege: z.string(), granted: z.boolean() });

/** Fails when the live catalog still grants `app_runtime` a privilege the manifest withholds. */
async function assertPrivilegesWithheld(pool: Pool, withheld: readonly WithheldPrivilegeEntry[]): Promise<void> {
	const violations: string[] = [];
	for (const entry of withheld) {
		for (const privilege of entry.privileges) {
			const result = await pool.query("SELECT $1::text AS table, $2::text AS privilege, has_table_privilege($3, $4, $2) AS granted", [
				entry.table,
				privilege,
				APP_RUNTIME_ROLE,
				`public.${entry.table}`,
			]);
			const row = PrivilegeRowSchema.parse(result.rows.at(0));
			if (row.granted) {
				violations.push(`${row.table}: ${row.privilege}`);
			}
		}
	}
	if (violations.length > 0) {
		throw new Error(`${APP_RUNTIME_ROLE} still holds withheld privileges: ${violations.join(", ")}`);
	}
}

const CatalogTableRowSchema = z.object({
	name: z.string(),
	primary_key_columns: z.array(z.string()),
	columns: z.array(z.string()),
});

/** Every ordinary / partitioned table in `public` (Prisma's bookkeeping table aside) with its primary key and columns. */
async function readDataChangeCatalog(pool: Pool): Promise<DataChangeCatalogTable[]> {
	const result = await pool.query(
		`SELECT c.relname AS name,
		        COALESCE((SELECT array_agg(a.attname::text ORDER BY k.position)
		                    FROM pg_index i
		                    CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, position)
		                    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
		                   WHERE i.indrelid = c.oid AND i.indisprimary), ARRAY[]::text[]) AS primary_key_columns,
		        (SELECT array_agg(a.attname::text ORDER BY a.attnum)
		           FROM pg_attribute a
		          WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS columns
		   FROM pg_class c
		   JOIN pg_namespace n ON n.oid = c.relnamespace
		  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relname <> $1
		  ORDER BY c.relname`,
		[PRISMA_MIGRATIONS_TABLE],
	);
	return z
		.array(CatalogTableRowSchema)
		.parse(result.rows)
		.map((row): DataChangeCatalogTable => ({ name: row.name, primaryKeyColumns: row.primary_key_columns, columns: row.columns }));
}

const TriggerRowSchema = z.object({ table: z.string(), trigger: z.string() });

/** Fails unless every captured table carries both capture triggers and no exempt table carries either. */
async function assertDataChangeCaptureInstalled(pool: Pool, plan: DataChangeCapturePlan): Promise<void> {
	const result = await pool.query(
		`SELECT c.relname AS table, t.tgname AS trigger
		   FROM pg_trigger t
		   JOIN pg_class c ON c.oid = t.tgrelid
		   JOIN pg_namespace n ON n.oid = c.relnamespace
		  WHERE n.nspname = 'public' AND NOT t.tgisinternal AND t.tgenabled <> 'D' AND t.tgname IN ($1, $2)`,
		[DATA_CHANGE_ROW_TRIGGER, DATA_CHANGE_TRUNCATE_TRIGGER],
	);
	const installed = new Set(
		z
			.array(TriggerRowSchema)
			.parse(result.rows)
			.map((row): string => `${row.table}.${row.trigger}`),
	);
	const triggers: readonly string[] = [DATA_CHANGE_ROW_TRIGGER, DATA_CHANGE_TRUNCATE_TRIGGER];
	const missing = plan.captured.flatMap((table): string[] =>
		triggers.map((trigger: string): string => `${table.name}.${trigger}`).filter((key: string): boolean => !installed.has(key)),
	);
	const unexpected = plan.exempt.flatMap((table: string): string[] =>
		triggers.map((trigger: string): string => `${table}.${trigger}`).filter((key: string): boolean => installed.has(key)),
	);
	if (missing.length > 0 || unexpected.length > 0) {
		throw new Error(
			`Data-change capture is not installed as planned. Missing (or disabled): ${missing.join(", ") || "none"}. On exempt tables: ${unexpected.join(", ") || "none"}.`,
		);
	}
}

/**
 * Apply the RLS SQL via the Node `pg` driver.
 *
 * The file list comes from `buildRlsApplyPlan` (`RLS_APPLY_ORDER` in
 * `scripts/rls-apply-plan.ts`), which validates disk drift and helper
 * use-before-definition BEFORE any SQL runs — so ordering bugs fail here
 * instead of against a fresh database. The privileges withheld from
 * `app_runtime` (`prisma/rls/withheld-privileges.ts`) are revoked with the
 * final grants file and then verified against the live catalog. Last, the
 * row-level data-change capture triggers (`prisma/rls/data-change-capture.ts`)
 * are planned against the live catalog, installed, and verified.
 *
 * No local `psql` binary required — only a reachable `DATABASE_URL` (Docker Postgres on localhost is fine).
 */
export async function applyRowLevelSecurity(): Promise<void> {
	const databaseUrl = stripPrismaQueryParams(getDatabaseUrl());
	const sqlFiles = buildRlsApplyPlan(apiDir);
	const withheld: WithheldPrivilegeEntry[] = listWithheldPrivileges();
	const pool = new Pool({ connectionString: databaseUrl });

	console.log("Applying Row-Level Security (idempotent) ...");

	try {
		for (const [index, sqlFile] of sqlFiles.entries()) {
			const relative = sqlFile.startsWith(apiDir) ? sqlFile.slice(apiDir.length + 1) : sqlFile;
			console.log(`  → ${relative}`);
			await runSqlInTransaction(pool, sqlForPlanFile(sqlFile, index === sqlFiles.length - 1, withheld));
		}

		await assertPrivilegesWithheld(pool, withheld);
		console.log(`  ✓ ${String(withheld.length)} tables keep their withheld ${APP_RUNTIME_ROLE} privileges`);

		// Row-level data-change capture (prisma/rls/data-change-capture.ts): planned against the live catalog, so a table
		// created by a migration since the last apply is captured now — or the apply fails on its unclassified columns.
		const capturePlan: DataChangeCapturePlan = planDataChangeCapture(await readDataChangeCatalog(pool));
		console.log("  → data-change capture triggers");
		await runSqlInTransaction(pool, buildDataChangeCaptureSql(capturePlan));
		await assertDataChangeCaptureInstalled(pool, capturePlan);
		console.log(`  ✓ ${String(capturePlan.captured.length)} tables capture every row change (${String(capturePlan.exempt.length)} declared exempt)`);
		console.log("RLS applied successfully.");
	} finally {
		await pool.end();
	}
}

function isApplyRlsCliEntry(): boolean {
	// argv = [node binary, script path, ...args]
	const [, entry] = process.argv;
	if (entry === undefined || entry.length === 0) {
		return false;
	}
	return resolve(entry) === fileURLToPath(import.meta.url);
}

const FailureSchema = z.object({ message: z.string() });

async function main(): Promise<void> {
	try {
		await applyRowLevelSecurity();
	} catch (error) {
		const failure = FailureSchema.safeParse(error);
		console.error("");
		console.error(`Error: ${failure.success ? failure.data.message : "RLS apply failed"}`);
		process.exit(1);
	}
}

if (isApplyRlsCliEntry()) {
	void main();
}
