import { describe, expect, it } from "vitest";

import { ALLOW_POLICY_DROPS_FLAG, DatabaseToolEnvError, policyDropsAllowed, readDatabaseToolEnv } from "../apply";

const DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/app_ci?schema=public";

describe("policyDropsAllowed", () => {
	it("always allows dropping undeclared policies outside production", () => {
		expect(policyDropsAllowed([], undefined)).toBe(true);
		expect(policyDropsAllowed([], "development")).toBe(true);
		expect(policyDropsAllowed([], "test")).toBe(true);
	});

	it("requires the explicit flag in production", () => {
		expect(policyDropsAllowed([], "production")).toBe(false);
		expect(policyDropsAllowed(["--verbose"], "production")).toBe(false);
		expect(policyDropsAllowed([ALLOW_POLICY_DROPS_FLAG], "production")).toBe(true);
	});
});

describe("readDatabaseToolEnv", () => {
	// The analytics-consumer CI job applies the security SQL with nothing but a database: no API secrets,
	// no app URLs. Validating the API's full configuration there failed `db:deploy` (CI run 44369401803).
	it("needs only DATABASE_URL, not the API's other settings", () => {
		expect(readDatabaseToolEnv({ DATABASE_URL })).toEqual({ DATABASE_URL, NODE_ENV: undefined });
	});

	it("reads NODE_ENV when it is set", () => {
		expect(readDatabaseToolEnv({ DATABASE_URL, NODE_ENV: "production" })).toEqual({ DATABASE_URL, NODE_ENV: "production" });
	});

	it("drops every other variable", () => {
		expect(readDatabaseToolEnv({ DATABASE_URL, JWT_ACCESS_SECRET: "x".repeat(64) })).toEqual({ DATABASE_URL, NODE_ENV: undefined });
	});

	it("names a missing DATABASE_URL", () => {
		expect(() => readDatabaseToolEnv({})).toThrow(DatabaseToolEnvError);
		expect(() => readDatabaseToolEnv({})).toThrow(/DATABASE_URL/);
	});

	it("rejects a URL that is not Postgres without printing it", () => {
		const secretUrl = "mysql://root:hunter2@localhost/app";
		const read = (): void => {
			readDatabaseToolEnv({ DATABASE_URL: secretUrl });
		};

		expect(read).toThrow(/DATABASE_URL: must be a postgres:\/\/ or postgresql:\/\/ connection URL/);
		expect(read).not.toThrow(/hunter2/);
	});

	it("rejects an unknown NODE_ENV", () => {
		expect(() => readDatabaseToolEnv({ DATABASE_URL, NODE_ENV: "staging" })).toThrow(/NODE_ENV/);
	});
});
