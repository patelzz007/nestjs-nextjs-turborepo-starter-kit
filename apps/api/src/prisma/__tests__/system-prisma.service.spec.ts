import { describe, expect, it } from "vitest";

import { createTestTypedConfig } from "../../../test/support/test-api-env";

import { DATABASE_APPLICATION_NAME, DATABASE_CONNECT_TIMEOUT_MS } from "../database-pool.constants";
import { databasePoolBudget } from "../prisma-client-setup";
import { buildSystemPoolConfig } from "../system-prisma.service";

const POOL_MAX = 7;
const IDLE_TIMEOUT_MS = 12_345;

describe("buildSystemPoolConfig", () => {
	it("bounds the system pool with its share of the DB_POOL_MAX budget and a connect timeout, and names its connections", () => {
		const config = createTestTypedConfig({ DB_POOL_MAX: String(POOL_MAX), DB_IDLE_TIMEOUT_MS: String(IDLE_TIMEOUT_MS) });

		expect(buildSystemPoolConfig(config)).toEqual({
			connectionString: config.database.url,
			max: databasePoolBudget(POOL_MAX).system,
			idleTimeoutMillis: IDLE_TIMEOUT_MS,
			allowExitOnIdle: config.database.allowExitOnIdle,
			connectionTimeoutMillis: DATABASE_CONNECT_TIMEOUT_MS,
			application_name: DATABASE_APPLICATION_NAME.system,
		});
	});
});
