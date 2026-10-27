import { describe, expect, it } from "vitest";

import {
	createWorkerDatabases,
	databaseNameOf,
	dropWorkerDatabases,
	e2eMaxWorkers,
	MAX_DEFAULT_E2E_WORKERS,
	newRunTag,
	waitForIdleSource,
	withDatabaseName,
	workerDatabaseName,
	workerDatabaseUrl,
	type DatabaseServer,
} from "../e2e-worker-databases";

/** Postgres's identifier limit, in bytes. */
const POSTGRES_IDENTIFIER_BYTES = 63;
const TEN_CORES = 10;
const TWO_CORES = 2;
const ONE_CORE = 1;
const FOUR_CORES = 4;

interface SessionRow {
	readonly application: string;
	readonly sessions: number;
}

/**
 * A recording database server: every statement is kept, the session query
 * answers from `sessionsPerPoll` (one entry per poll, the last repeating), and
 * CREATE DATABASE fails for the names in `failingCreates`.
 */
function recordingServer(
	sessionsPerPoll: readonly (readonly SessionRow[])[] = [[]],
	failingCreates: readonly string[] = [],
): { readonly server: DatabaseServer; readonly statements: string[] } {
	const statements: string[] = [];
	let polls = 0;
	const server: DatabaseServer = {
		query: async (text: string): Promise<{ readonly rows: readonly object[] }> => {
			statements.push(text);
			if (text.includes("pg_stat_activity")) {
				const rows = sessionsPerPoll.at(Math.min(polls, sessionsPerPoll.length - 1)) ?? [];
				polls += 1;
				return Promise.resolve({ rows });
			}
			if (failingCreates.some((name: string): boolean => text.startsWith(`CREATE DATABASE "${name}"`))) {
				return Promise.reject(new Error(`could not create ${text}`));
			}
			return Promise.resolve({ rows: [] });
		},
	};
	return { server, statements };
}

describe("e2eMaxWorkers", () => {
	it("defaults to half the cores, at most the default cap and at least one", () => {
		expect(e2eMaxWorkers(undefined, TEN_CORES)).toBe(MAX_DEFAULT_E2E_WORKERS);
		expect(e2eMaxWorkers(undefined, FOUR_CORES)).toBe(TWO_CORES);
		expect(e2eMaxWorkers(undefined, ONE_CORE)).toBe(1);
		expect(e2eMaxWorkers("", TEN_CORES)).toBe(MAX_DEFAULT_E2E_WORKERS);
	});

	it("takes E2E_MAX_WORKERS when set, and refuses anything but a positive integer", () => {
		expect(e2eMaxWorkers("6", TWO_CORES)).toBe(6);
		expect(() => e2eMaxWorkers("0", TEN_CORES)).toThrow();
		expect(() => e2eMaxWorkers("two", TEN_CORES)).toThrow();
	});
});

describe("databaseNameOf / withDatabaseName", () => {
	it("reads and replaces the database name, keeping server, credentials and query", () => {
		const url = "postgresql://postgres:secret@localhost:5432/nestjs-nextjs-starter?schema=public";

		expect(databaseNameOf(url)).toBe("nestjs-nextjs-starter");
		expect(withDatabaseName(url, "copy_w1")).toBe("postgresql://postgres:secret@localhost:5432/copy_w1?schema=public");
	});

	it("refuses a URL without a database name", () => {
		expect(() => databaseNameOf("postgresql://postgres@localhost:5432/")).toThrow(/must name a database/);
	});
});

describe("workerDatabaseName", () => {
	it("names each worker's copy after the source, the run and the worker", () => {
		expect(workerDatabaseName("app_ci", "0b1c2d3e", 2)).toBe("app_ci_e2e_0b1c2d3e_w2");
	});

	it("shortens a long source name so the whole name fits Postgres's identifier limit", () => {
		const name = workerDatabaseName("x".repeat(POSTGRES_IDENTIFIER_BYTES), "0b1c2d3e", 12);

		expect(Buffer.byteLength(name)).toBeLessThanOrEqual(POSTGRES_IDENTIFIER_BYTES);
		expect(name.endsWith("_e2e_0b1c2d3e_w12")).toBe(true);
	});

	it("gets a different run tag every run", () => {
		expect(newRunTag()).toMatch(/^[0-9a-f]{8}$/);
		expect(newRunTag()).not.toBe(newRunTag());
	});
});

describe("workerDatabaseUrl", () => {
	const urls = ["postgresql://localhost/app_w1", "postgresql://localhost/app_w2"];

	it("gives worker n (VITEST_POOL_ID) the n-th copy", () => {
		expect(workerDatabaseUrl(urls, "1")).toBe("postgresql://localhost/app_w1");
		expect(workerDatabaseUrl(urls, "2")).toBe("postgresql://localhost/app_w2");
	});

	it("refuses a worker the global setup made no copy for, or no worker id at all", () => {
		expect(() => workerDatabaseUrl(urls, "3")).toThrow(/worker 3 has no database: the global setup made 2/);
		expect(() => workerDatabaseUrl(urls, undefined)).toThrow();
	});
});

describe("waitForIdleSource", () => {
	it("returns once the other sessions have left the source", async () => {
		const { server, statements } = recordingServer([[{ application: "seed", sessions: 1 }], []]);

		await waitForIdleSource(server, "app_ci");

		expect(statements).toHaveLength(2);
	});

	it("names what is still connected when the source never becomes idle", async () => {
		const { server } = recordingServer([[{ application: "hello-world:request", sessions: 3 }]]);

		await expect(waitForIdleSource(server, "app_dev", 0)).rejects.toThrow(/"app_dev".*hello-world:request \(3\)/);
	});
});

describe("createWorkerDatabases / dropWorkerDatabases", () => {
	it("copies the idle source once per worker with a file copy, then drops the copies forcibly", async () => {
		const { server, statements } = recordingServer();

		await createWorkerDatabases(server, "app-ci", ["app-ci_e2e_t_w1", "app-ci_e2e_t_w2"]);
		await dropWorkerDatabases(server, ["app-ci_e2e_t_w1", "app-ci_e2e_t_w2"]);

		expect(statements.slice(1)).toEqual([
			'CREATE DATABASE "app-ci_e2e_t_w1" TEMPLATE "app-ci" STRATEGY FILE_COPY',
			'CREATE DATABASE "app-ci_e2e_t_w2" TEMPLATE "app-ci" STRATEGY FILE_COPY',
			'DROP DATABASE IF EXISTS "app-ci_e2e_t_w1" WITH (FORCE)',
			'DROP DATABASE IF EXISTS "app-ci_e2e_t_w2" WITH (FORCE)',
		]);
	});

	it("drops the copies already made when a later copy fails", async () => {
		const { server, statements } = recordingServer([[]], ["app_e2e_t_w2"]);

		await expect(createWorkerDatabases(server, "app", ["app_e2e_t_w1", "app_e2e_t_w2", "app_e2e_t_w3"])).rejects.toThrow(/could not create/);

		expect(statements.slice(1)).toEqual([
			'CREATE DATABASE "app_e2e_t_w1" TEMPLATE "app" STRATEGY FILE_COPY',
			'CREATE DATABASE "app_e2e_t_w2" TEMPLATE "app" STRATEGY FILE_COPY',
			'DROP DATABASE IF EXISTS "app_e2e_t_w1" WITH (FORCE)',
		]);
	});

	it("copies nothing while another session holds the source", async () => {
		const { server, statements } = recordingServer([[{ application: "?", sessions: 1 }]]);

		await expect(createWorkerDatabases(server, "app", ["app_e2e_t_w1"], 0)).rejects.toThrow(/\? \(1\)/);
		expect(statements.some((statement: string): boolean => statement.startsWith("CREATE DATABASE"))).toBe(false);
	});
});
