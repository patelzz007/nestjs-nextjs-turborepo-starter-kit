import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { z } from "zod";

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
async function runSqlFile(pool: Pool, sqlFile: string): Promise<void> {
	const sql = readFileSync(sqlFile, "utf8");

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

/**
 * Apply the RLS SQL via the Node `pg` driver.
 *
 * The file list comes from `buildRlsApplyPlan` (`RLS_APPLY_ORDER` in
 * `scripts/rls-apply-plan.ts`), which validates disk drift and helper
 * use-before-definition BEFORE any SQL runs — so ordering bugs fail here
 * instead of against a fresh database.
 *
 * No local `psql` binary required — only a reachable `DATABASE_URL` (Docker Postgres on localhost is fine).
 */
export async function applyRowLevelSecurity(): Promise<void> {
	const databaseUrl = stripPrismaQueryParams(getDatabaseUrl());
	const sqlFiles = buildRlsApplyPlan(apiDir);
	const pool = new Pool({ connectionString: databaseUrl });

	console.log("Applying Row-Level Security (idempotent) ...");

	try {
		for (const sqlFile of sqlFiles) {
			const relative = sqlFile.startsWith(apiDir) ? sqlFile.slice(apiDir.length + 1) : sqlFile;
			console.log(`  → ${relative}`);
			await runSqlFile(pool, sqlFile);
		}

		console.log("RLS applied successfully.");
	} finally {
		await pool.end();
	}
}

function isApplyRlsCliEntry(): boolean {
	const entry = process.argv[1];
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
