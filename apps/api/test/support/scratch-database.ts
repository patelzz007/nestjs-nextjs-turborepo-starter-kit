import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { Pool } from "pg";

const API_ROOT: string = resolve(import.meta.dirname, "..", "..");
const SUBPROCESS_TIMEOUT_MS = 180_000;
const NAME_SUFFIX_LENGTH = 12;

/** A throwaway database created next to the shared one, migrated and RLS-applied but UNSEEDED — exactly a real deployment. */
export interface ScratchDatabase {
	/** Connection string of the scratch database. */
	readonly url: string;
	/** A pool on it, for arranging and inspecting rows as the database owner (bypasses RLS). */
	readonly pool: Pool;
	/**
	 * Registers something connected to the scratch database (an app, a Prisma client, a pool) so {@link drop}
	 * closes it FIRST. Specs must register every client they open; `drop` never leaves one for PostgreSQL to kill.
	 */
	track(close: () => Promise<void>): void;
	/** Closes every tracked client (newest first), then the helper pool, then drops the database. */
	drop(): Promise<void>;
}

export const SCRATCH_SETUP_TIMEOUT_MS: number = SUBPROCESS_TIMEOUT_MS * 2;

function withDatabase(url: string, database: string): string {
	const parsed = new URL(url);
	parsed.pathname = `/${database}`;
	return parsed.toString();
}

/** Runs a workspace binary (`prisma`, `tsx` — on PATH under `pnpm exec vitest`, like prisma/seed-bootstrap.ts) against `databaseUrl`. */
function runInApi(command: string, args: readonly string[], databaseUrl: string): void {
	const result = spawnSync(command, [...args], { cwd: API_ROOT, env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: "utf8", timeout: SUBPROCESS_TIMEOUT_MS });
	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(" ")} failed (${String(result.status)}): ${String(result.error)}\n${result.stdout}\n${result.stderr}`);
	}
}

/**
 * Creates `<prefix>_<random>` on the server `serverUrl` points at, migrates it and applies RLS. The shared
 * database is only used to issue CREATE / DROP DATABASE; its rows are never touched.
 */
export async function createScratchDatabase(serverUrl: string, prefix: string): Promise<ScratchDatabase> {
	const name = `${prefix}_${randomUUID().replaceAll("-", "").slice(0, NAME_SUFFIX_LENGTH)}`;
	const url: string = withDatabase(serverUrl, name);
	const server = new Pool({ connectionString: serverUrl });
	const pool = new Pool({ connectionString: url });
	// An idle client the server terminates emits 'error' on its pool; without a listener that is an unhandled
	// error. After the ordered teardown below none should remain, so this only guards a crash mid-setup.
	for (const guarded of [server, pool]) {
		guarded.on("error", (): void => undefined);
	}
	const tracked: (() => Promise<void>)[] = [];
	const dropDatabase = async (): Promise<void> => {
		await server.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
		await server.end();
	};
	try {
		await server.query(`CREATE DATABASE "${name}"`);
		runInApi("prisma", ["migrate", "deploy"], url);
		runInApi("tsx", ["scripts/apply-rls.ts"], url);
	} catch (error) {
		await pool.end();
		await dropDatabase();
		throw error;
	}
	return {
		url,
		pool,
		track: (close: () => Promise<void>): void => {
			tracked.push(close);
		},
		drop: async (): Promise<void> => {
			// Close everything connected to the database BEFORE dropping it, so no idle client is terminated by the DROP.
			const results = await Promise.allSettled([...tracked].reverse().map((close: () => Promise<void>): Promise<void> => close()));
			await pool.end();
			await dropDatabase();
			const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
			if (failed !== undefined) {
				throw failed.reason instanceof Error ? failed.reason : new Error("closing a scratch-database client failed");
			}
		},
	};
}
