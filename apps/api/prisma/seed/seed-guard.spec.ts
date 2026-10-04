import { describe, expect, it } from "vitest";

import { assertSeedAllowed, seedRefusalReason, SeedRefusedError } from "./seed-guard";

const LOCAL_URL = "postgresql://postgres:postgres@localhost:5432/app?schema=public";

describe("seed guard", () => {
	it("allows a local database in development or test", () => {
		expect(seedRefusalReason({ NODE_ENV: "development", DATABASE_URL: LOCAL_URL })).toBeNull();
		expect(seedRefusalReason({ NODE_ENV: "test", DATABASE_URL: "postgresql://u:p@127.0.0.1/app" })).toBeNull();
		expect(seedRefusalReason({ NODE_ENV: "development", DATABASE_URL: "postgresql://u:p@postgres:5432/app" })).toBeNull();
	});

	it("refuses production, a missing NODE_ENV and a remote host", () => {
		expect(() => {
			assertSeedAllowed({ NODE_ENV: "production", DATABASE_URL: LOCAL_URL }, false);
		}).toThrow(SeedRefusedError);
		expect(() => {
			assertSeedAllowed({ DATABASE_URL: LOCAL_URL }, false);
		}).toThrow(SeedRefusedError);
		expect(() => {
			assertSeedAllowed({ NODE_ENV: "development", DATABASE_URL: "postgresql://u:p@db.prod.internal:5432/app" }, false);
		}).toThrow(/not a local database/u);
	});

	it("lets an explicit --allow-destructive through", () => {
		expect(() => {
			assertSeedAllowed({ NODE_ENV: "production", DATABASE_URL: "postgresql://u:p@db.prod.internal/app" }, true);
		}).not.toThrow();
	});
});
