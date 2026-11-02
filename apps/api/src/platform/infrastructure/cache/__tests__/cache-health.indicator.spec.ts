import { describe, expect, it } from "vitest";

import { localAppCache } from "../../../../../test/support/local-app-cache";
import { createTestTypedConfig } from "../../../../../test/support/test-api-env";
import { cacheMemoryOverAlert } from "../../../application/ports/app-cache.port";
import { CacheHealthIndicator } from "../cache-health.indicator";

describe("cacheMemoryOverAlert", () => {
	it("is over at the alert share of maxmemory, and never without a maxmemory", () => {
		expect(cacheMemoryOverAlert({ usedBytes: 80, maxBytes: 100, policy: "noeviction" }, 80)).toBe(true);
		expect(cacheMemoryOverAlert({ usedBytes: 79, maxBytes: 100, policy: "noeviction" }, 80)).toBe(false);
		expect(cacheMemoryOverAlert({ usedBytes: 999, maxBytes: null, policy: "noeviction" }, 80)).toBe(false);
	});
});

describe("CacheHealthIndicator", () => {
	it("is healthy without Redis (every tier answers from this process) and reports why", async () => {
		const indicator = new CacheHealthIndicator(localAppCache(), createTestTypedConfig());

		await expect(indicator.isHealthy()).resolves.toBe(true);
		await expect(indicator.getReport()).resolves.toMatchObject({ circuitOpen: false, redisUsedBytes: null, redisPolicy: null, alertPercent: 80 });
	});
});
