import { describe, expect, it } from "vitest";

import { bullMqHealthReport } from "./bullmq-infrastructure.module";

const REDIS_URL_WITH_CREDENTIALS = "redis://default:s3cr3t-pass@cache.internal:6379/0";

describe("bullMqHealthReport", () => {
	it("reports a configured Redis without ever echoing its URL (it may carry credentials)", () => {
		const report = bullMqHealthReport({ redisUrl: REDIS_URL_WITH_CREDENTIALS, bullPrefix: "bull" });

		expect(report).toEqual({ backend: "bullmq", redis: "configured", prefix: "bull" });
		expect(JSON.stringify(report)).not.toContain("s3cr3t-pass");
		expect(JSON.stringify(report)).not.toContain("cache.internal");
	});

	it("reports a disabled backend when no Redis URL is set", () => {
		expect(bullMqHealthReport({ redisUrl: undefined, bullPrefix: "jobs" })).toEqual({ backend: "disabled", redis: "unset", prefix: "jobs" });
	});
});
