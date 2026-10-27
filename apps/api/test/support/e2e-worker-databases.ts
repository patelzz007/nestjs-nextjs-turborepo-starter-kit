import { randomUUID } from "node:crypto";
import { availableParallelism } from "node:os";

import { escapeIdentifier } from "pg";
import { z } from "zod";

/**
 * Per-worker databases for the parallel e2e run.
 *
 * Test files run in parallel, one Vitest worker each, and every file writes
 * rows. Sharing one database would let a file see (or break on) another
 * file's half-finished rows, so the global setup copies the run's database
 * once per worker (`CREATE DATABASE … TEMPLATE`, a file copy: about a quarter
 * of a second for the seeded development scenario) and each worker points
 * `DATABASE_URL` at its own copy (test/setup-env.ts). The copies are dropped
 * when the run ends. The source database itself is only read, never written.
 */

/** Postgres identifiers are limited to 63 bytes. */
const MAX_IDENTIFIER_BYTES = 63;
/** Hex characters of the per-run tag in a copy's name, so two runs on one server never collide. */
const RUN_TAG_LENGTH = 8;
/** Default upper bound of e2e workers: each one boots the whole API and holds its own database pools. */
export const MAX_DEFAULT_E2E_WORKERS = 4;
/** Default share of the machine's cores: every worker's queries also keep Postgres busy on the same machine. */
const CORES_PER_DEFAULT_WORKER = 2;
/** How long the global setup waits for other sessions to leave the source database before giving up. */
export const SOURCE_IDLE_DEADLINE_MS = 15_000;
const SOURCE_IDLE_POLL_MS = 250;

const PositiveIntegerSchema = z.coerce.number().int().positive();
const SessionRowSchema = z.object({ application: z.string(), sessions: z.coerce.number().int().positive() });

/**
 * The number of e2e workers: `E2E_MAX_WORKERS` when set, otherwise half the
 * cores, at most {@link MAX_DEFAULT_E2E_WORKERS}, at least one.
 */
export function e2eMaxWorkers(requested: string | undefined, cores: number = availableParallelism()): number {
	if (requested !== undefined && requested.trim() !== "") {
		return PositiveIntegerSchema.parse(requested);
	}
	return Math.max(1, Math.min(MAX_DEFAULT_E2E_WORKERS, Math.floor(cores / CORES_PER_DEFAULT_WORKER)));
}

/** The database name in a Postgres connection string. */
export function databaseNameOf(url: string): string {
	const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
	if (name.length === 0) {
		throw new Error("DATABASE_URL must name a database (e.g. postgresql://user:pass@localhost:5432/app)");
	}
	return name;
}

/** `url` pointing at database `database` (same server, credentials and query). */
export function withDatabaseName(url: string, database: string): string {
	const parsed = new URL(url);
	parsed.pathname = `/${encodeURIComponent(database)}`;
	return parsed.toString();
}

/**
 * The name of worker `worker`'s copy of `source`: `<source>_e2e_<runTag>_w<worker>`,
 * the source part shortened so the whole name fits Postgres's 63 bytes.
 */
export function workerDatabaseName(source: string, runTag: string, worker: number): string {
	const suffix = `_e2e_${runTag}_w${String(worker)}`;
	let base = source;
	while (base.length > 0 && Buffer.byteLength(`${base}${suffix}`) > MAX_IDENTIFIER_BYTES) {
		base = base.slice(0, -1);
	}
	return `${base}${suffix}`;
}

/** A fresh run tag for {@link workerDatabaseName}. */
export function newRunTag(): string {
	return randomUUID().replaceAll("-", "").slice(0, RUN_TAG_LENGTH);
}

/**
 * The database URL of the worker running this file: `VITEST_POOL_ID` (1 to
 * `maxWorkers`, never shared by two files running at the same time) picks its copy.
 */
export function workerDatabaseUrl(urls: readonly string[], poolId: string | undefined): string {
	const worker = PositiveIntegerSchema.parse(poolId);
	const url = urls.at(worker - 1);
	if (url === undefined) {
		throw new Error(`e2e worker ${String(worker)} has no database: the global setup made ${String(urls.length)} (one per worker)`);
	}
	return url;
}

/** The one query method the copies need — a `pg` Pool satisfies it. */
export interface DatabaseServer {
	query(text: string, values?: readonly string[]): Promise<{ readonly rows: readonly object[] }>;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolveSleep): void => {
		setTimeout(resolveSleep, ms);
	});
}

/** The other sessions on `database`, by application name (`?` for an unnamed one). */
async function otherSessions(server: DatabaseServer, database: string): Promise<readonly z.output<typeof SessionRowSchema>[]> {
	const result = await server.query(
		"SELECT coalesce(nullif(application_name, ''), '?') AS application, count(*) AS sessions FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid() GROUP BY 1 ORDER BY 1",
		[database],
	);
	return z.array(SessionRowSchema).parse(result.rows);
}

/**
 * Waits until nothing but `server`'s own session is connected to `source`:
 * Postgres copies a database only while no other session uses it. A process
 * that just finished (the seed, a migration) can take a moment to leave.
 */
export async function waitForIdleSource(server: DatabaseServer, source: string, deadlineMs: number = SOURCE_IDLE_DEADLINE_MS): Promise<void> {
	const deadline = Date.now() + deadlineMs;
	for (;;) {
		const sessions = await otherSessions(server, source);
		if (sessions.length === 0) {
			return;
		}
		if (Date.now() >= deadline) {
			const connected = sessions.map((row): string => `${row.application} (${String(row.sessions)})`).join(", ");
			throw new Error(
				`e2e copies database "${source}" once per worker, which Postgres only allows while nothing else is connected to it. ` +
					`Still connected after ${String(deadlineMs)} ms: ${connected}. Stop what is using it (a running dev API: stop \`pnpm dev\`) ` +
					`or point DATABASE_URL at a database nothing else uses.`,
			);
		}
		await sleep(SOURCE_IDLE_POLL_MS);
	}
}

/**
 * Copies `source` into each of `names` (`STRATEGY FILE_COPY`: a file-level
 * copy, much faster than the WAL-logged default for a seeded database), one at
 * a time since each copy needs the source to itself — after waiting up to
 * `idleDeadlineMs` for it to become idle. Copies already made are dropped when
 * a later one fails.
 */
export async function createWorkerDatabases(
	server: DatabaseServer,
	source: string,
	names: readonly string[],
	idleDeadlineMs: number = SOURCE_IDLE_DEADLINE_MS,
): Promise<void> {
	await waitForIdleSource(server, source, idleDeadlineMs);
	const created: string[] = [];
	try {
		for (const name of names) {
			await server.query(`CREATE DATABASE ${escapeIdentifier(name)} TEMPLATE ${escapeIdentifier(source)} STRATEGY FILE_COPY`);
			created.push(name);
		}
	} catch (error) {
		await dropWorkerDatabases(server, created);
		throw error;
	}
}

/** Drops the worker copies, disconnecting any session still on one (`WITH (FORCE)`). */
export async function dropWorkerDatabases(server: DatabaseServer, names: readonly string[]): Promise<void> {
	for (const name of names) {
		await server.query(`DROP DATABASE IF EXISTS ${escapeIdentifier(name)} WITH (FORCE)`);
	}
}
