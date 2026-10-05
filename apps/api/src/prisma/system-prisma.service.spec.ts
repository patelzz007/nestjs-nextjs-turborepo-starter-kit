import { describe, expect, it } from "vitest";

import { createTestTypedConfig } from "../../test/support/test-api-env";

import { DATABASE_CONNECT_TIMEOUT_MS } from "./database-pool.constants";
import { buildSystemPoolConfig } from "./system-prisma.service";

const POOL_MAX = 7;
const IDLE_TIMEOUT_MS = 12_345;

describe("buildSystemPoolConfig", () => {
	it("bounds the system pool with the validated limits and a connect timeout", () => {
		const config = createTestTypedConfig({ DB_POOL_MAX: String(POOL_MAX), DB_IDLE_TIMEOUT_MS: String(IDLE_TIMEOUT_MS) });

		expect(buildSystemPoolConfig(config)).toEqual({
			connectionString: config.database.url,
			max: POOL_MAX,
			idleTimeoutMillis: IDLE_TIMEOUT_MS,
			allowExitOnIdle: config.database.allowExitOnIdle,
			connectionTimeoutMillis: DATABASE_CONNECT_TIMEOUT_MS,
		});
	});
});
