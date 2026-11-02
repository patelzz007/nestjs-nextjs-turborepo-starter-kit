import { Logger } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { RateLimitDecision, RateLimiter, RateLimitRequest, SlidingWindowRule, TokenBucketRule } from "../../../application/ports/rate-limiter.port";
import { FailoverRateLimiter, localShareOf } from "../failover-rate-limiter";
import { MemoryRateLimiter } from "../memory-rate-limiter";

const INSTANCES = 4;
const LIMIT = 8;
const WINDOW_MS = 60_000;
const MAX_KEYS = 100;

/** A shared store that cannot answer (Redis down). */
class UnreachableLimiter extends MemoryRateLimiter {
	public override consume(): Promise<RateLimitDecision> {
		return Promise.reject(new Error("connect ECONNREFUSED 127.0.0.1:6379"));
	}
}

const rule: SlidingWindowRule = { algorithm: "sliding-window", limit: LIMIT, windowMs: WINDOW_MS, penalty: null };

function request(failMode: RateLimitRequest["failMode"]): RateLimitRequest {
	return { policyName: "probe", rule, subject: { kind: "ip", id: "203.0.113.1" }, cost: 1, failMode };
}

async function allowedCount(limiter: RateLimiter, failMode: RateLimitRequest["failMode"]): Promise<number> {
	let allowed = 0;
	for (let attempt = 0; attempt < LIMIT; attempt += 1) {
		if ((await limiter.consume(request(failMode))).allowed) {
			allowed += 1;
		}
	}
	return allowed;
}

function silentLogger(): Logger {
	const logger = new Logger("test");
	vi.spyOn(logger, "warn").mockImplementation((): void => undefined);
	return logger;
}

function silentLoggerWithWarnSpy(): { readonly logger: Logger; readonly warn: ReturnType<typeof vi.fn> } {
	const logger = new Logger("test");
	const warn = vi.fn();
	vi.spyOn(logger, "warn").mockImplementation(warn);
	return { logger, warn };
}

describe("localShareOf", () => {
	it("divides a window's limit and a bucket's rate and burst, never below one", () => {
		expect(localShareOf(rule, INSTANCES)).toMatchObject({ limit: LIMIT / INSTANCES });
		expect(localShareOf({ ...rule, limit: 1 }, INSTANCES)).toMatchObject({ limit: 1 });
		const bucket: TokenBucketRule = { algorithm: "token-bucket", ratePerSecond: LIMIT, burst: LIMIT };
		expect(localShareOf(bucket, INSTANCES)).toEqual({ algorithm: "token-bucket", ratePerSecond: LIMIT / INSTANCES, burst: LIMIT / INSTANCES });
	});
});

describe("FailoverRateLimiter", () => {
	it("answers from the shared store while it works", async () => {
		const shared = new MemoryRateLimiter({ maxKeys: MAX_KEYS });
		const sharedConsume = vi.spyOn(shared, "consume");
		const limiter = new FailoverRateLimiter(shared, new MemoryRateLimiter({ maxKeys: MAX_KEYS }), INSTANCES, silentLogger());

		await limiter.consume(request("open"));
		expect(sharedConsume).toHaveBeenCalledTimes(1);
	});

	it("counts the FULL limit locally for a closed (security) policy when the shared store fails, and logs it", async () => {
		const { logger, warn } = silentLoggerWithWarnSpy();
		const limiter = new FailoverRateLimiter(new UnreachableLimiter({ maxKeys: MAX_KEYS }), new MemoryRateLimiter({ maxKeys: MAX_KEYS }), INSTANCES, logger);

		expect(await allowedCount(limiter, "closed")).toBe(LIMIT);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("rate_limit.shared_store_unavailable policy=probe"), expect.any(Error));
	});

	it("counts only this instance's share locally for an open policy when the shared store fails", async () => {
		const limiter = new FailoverRateLimiter(new UnreachableLimiter({ maxKeys: MAX_KEYS }), new MemoryRateLimiter({ maxKeys: MAX_KEYS }), INSTANCES, silentLogger());

		expect(await allowedCount(limiter, "open")).toBe(LIMIT / INSTANCES);
	});

	it("without Redis counts the full limit locally", async () => {
		const limiter = new FailoverRateLimiter(null, new MemoryRateLimiter({ maxKeys: MAX_KEYS }), INSTANCES, silentLogger());

		expect(await allowedCount(limiter, "open")).toBe(LIMIT);
	});
});
