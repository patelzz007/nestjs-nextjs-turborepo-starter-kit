import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

import { countStatements } from "../sql-statement-counter";
import { createScratchDatabase } from "../scratch-database";

const SMALL_PAGE = 1;
const LARGE_PAGE = 25;

/** Scratch DB creation connects to the server catalog, not the app database named in DATABASE_URL. */
function postgresAdminUrl(databaseUrl: string): string {
	const parsed = new URL(databaseUrl);
	parsed.pathname = "/postgres";
	return parsed.toString();
}

describe("sql-statement-counter", () => {
	const configuredUrl = process.env.DATABASE_URL;
	let serverUrl: string | null = null;

	beforeAll(async (): Promise<void> => {
		if (configuredUrl === undefined || configuredUrl.length === 0) {
			return;
		}
		const adminUrl = postgresAdminUrl(configuredUrl);
		const probe = new Pool({ connectionString: adminUrl });
		try {
			await probe.query("SELECT 1 AS ok");
			serverUrl = adminUrl;
		} catch {
			serverUrl = null;
		} finally {
			await probe.end();
		}
	});

	let scratch: Awaited<ReturnType<typeof createScratchDatabase>> | undefined;

	afterEach(async (): Promise<void> => {
		if (scratch !== undefined) {
			await scratch.drop();
			scratch = undefined;
		}
	});

	it("counts user SQL and ignores transaction/RLS housekeeping", async (context): Promise<void> => {
		if (serverUrl === null) {
			context.skip();
			return;
		}
		const database = await createScratchDatabase(serverUrl, "sql_counter");
		scratch = database;
		const userStatements = await countStatements(database.pool, async (): Promise<void> => {
			await database.pool.query("SELECT 1 AS one");
			await database.pool.query("SELECT 2 AS two");
		});
		expect(userStatements).toBe(2);

		const housekeepingStatements = await countStatements(database.pool, async (): Promise<void> => {
			await database.pool.query("BEGIN");
			await database.pool.query("COMMIT");
		});
		expect(housekeepingStatements).toBe(0);
	}, 60_000);

	it("never counts the app's background work on the same pool — only the measured work's own statements", async (context): Promise<void> => {
		if (serverUrl === null) {
			context.skip();
			return;
		}
		const database = await createScratchDatabase(serverUrl, "sql_counter_background");
		scratch = database;
		let backgroundQueries = 0;
		const background: NodeJS.Timeout = setInterval((): void => {
			backgroundQueries += 1;
			void database.pool.query("SELECT 'background' AS sweep");
		}, 1);
		try {
			const measured = await countStatements(database.pool, async (): Promise<void> => {
				for (let index = 0; index < SMALL_PAGE + 2; index += 1) {
					await database.pool.query("SELECT pg_sleep(0.01)");
				}
			});
			expect(measured).toBe(SMALL_PAGE + 2);
			expect(backgroundQueries).toBeGreaterThan(0);
		} finally {
			clearInterval(background);
		}
	}, 60_000);

	it("counts the same for repeated identical selects (sanity for N+1 helper)", async (context): Promise<void> => {
		if (serverUrl === null) {
			context.skip();
			return;
		}
		const database = await createScratchDatabase(serverUrl, "sql_counter_n1");
		scratch = database;
		const run = async (pageSize: number): Promise<void> => {
			for (let index = 0; index < pageSize; index += 1) {
				await database.pool.query("SELECT $1::int AS n", [index + 1]);
			}
		};
		const oneRow = await countStatements(database.pool, () => run(SMALL_PAGE));
		const manyRows = await countStatements(database.pool, () => run(LARGE_PAGE));
		expect(manyRows).toBeGreaterThan(oneRow);
	}, 60_000);
});
