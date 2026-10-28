import { describe, expect, it } from "vitest";

import { loadRunnerEnv } from "../env";

describe("loadRunnerEnv", () => {
	it("defaults the BullMQ prefix and the k6 binary", () => {
		expect(loadRunnerEnv({ REDIS_URL: "redis://localhost:6379" })).toMatchObject({
			REDIS_URL: "redis://localhost:6379",
			BULLMQ_PREFIX: "bull",
			K6_BINARY: "k6",
			K6_VERBOSE: false,
		});
		expect(loadRunnerEnv({ REDIS_URL: "redis://r" }).LOAD_TEST_TARGET_URL).toBeUndefined();
	});

	it("reads the target override and verbose flag", () => {
		expect(loadRunnerEnv({ REDIS_URL: "redis://r", LOAD_TEST_TARGET_URL: "http://host.docker.internal:8080", K6_VERBOSE: "true" })).toMatchObject({
			LOAD_TEST_TARGET_URL: "http://host.docker.internal:8080",
			K6_VERBOSE: true,
		});
	});

	it("refuses to start without Redis", () => {
		expect(() => loadRunnerEnv({})).toThrow();
	});
});
