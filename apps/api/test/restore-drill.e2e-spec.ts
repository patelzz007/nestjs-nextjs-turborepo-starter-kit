import { spawn } from "node:child_process";
import { Readable } from "node:stream";

import { Prisma } from "@prisma/client";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { getApiConfig } from "../src/config/api-config";
import { pgEnvironment } from "../src/contexts/operations/infrastructure/backup/pg-dump.adapter";
import { PgRestoreDrillAdapter } from "../src/contexts/operations/infrastructure/backup/pg-restore-drill.adapter";

const DRILL_TIMEOUT_MS = 300_000;
/** Where `pg_dump` and `pg_restore` are found: the same validated setting the API uses. */
const EXECUTABLE_SEARCH_PATH: string = getApiConfig().operations.executableSearchPath;

/** `pg_dump --format=custom` of `url`, the way a backup is taken, as a stream. */
function dumpOf(url: string): Readable {
	const child = spawn("pg_dump", ["--format=custom", "--no-owner", "--no-privileges"], {
		env: { PATH: EXECUTABLE_SEARCH_PATH, ...pgEnvironment(url) },
		stdio: ["ignore", "pipe", "inherit"],
	});
	return child.stdout;
}

/**
 * Enhancement 2.6: the restore drill against a real backup of this run's database, restored into a throwaway
 * database on the same server with the real `pg_restore`, checked, and dropped.
 */
describe("Backup restore drill (e2e, real pg_dump and pg_restore)", () => {
	let pool: Pool;
	let serverUrl: string;

	async function drillDatabases(): Promise<readonly string[]> {
		return z
			.array(z.object({ datname: z.string() }))
			.parse((await pool.query(`SELECT datname FROM pg_database WHERE datname LIKE 'restore_drill_%'`)).rows)
			.map((row) => row.datname);
	}

	beforeAll(() => {
		const url = new URL(z.string().min(1).parse(process.env.DATABASE_URL));
		url.pathname = "/postgres";
		url.search = "";
		serverUrl = url.toString();
		pool = new Pool({ connectionString: serverUrl });
	});

	afterAll(async () => {
		await pool.end();
	});

	it(
		"restores a real backup, finds every table, rows, the migration and row-level security, then drops the copy",
		async () => {
			const before = await drillDatabases();
			const checks = await new PgRestoreDrillAdapter(serverUrl, EXECUTABLE_SEARCH_PATH).restoreAndCheck(dumpOf(z.string().parse(process.env.DATABASE_URL)));

			expect(checks.failures).toStrictEqual([]);
			expect(checks.tablesChecked).toBe(Object.values(Prisma.ModelName).length);
			expect(checks.rowsRestored).toBeGreaterThan(0);
			expect(checks.migration).toMatch(/_init$|_[a-z_]+$/u);
			expect(await drillDatabases()).toStrictEqual(before);
		},
		DRILL_TIMEOUT_MS,
	);

	it(
		"reports a backup that won't restore, and still drops the copy",
		async () => {
			const before = await drillDatabases();
			const checks = await new PgRestoreDrillAdapter(serverUrl, EXECUTABLE_SEARCH_PATH).restoreAndCheck(Readable.from([Buffer.from("not a pg_dump archive")]));
			expect(checks.failures.join(" ")).toMatch(/^pg_restore failed/u);
			expect(await drillDatabases()).toStrictEqual(before);
		},
		DRILL_TIMEOUT_MS,
	);
});
