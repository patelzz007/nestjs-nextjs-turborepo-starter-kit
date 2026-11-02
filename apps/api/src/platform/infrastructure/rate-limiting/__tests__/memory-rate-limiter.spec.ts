import { describe, expect, it } from "vitest";

import type { ConcurrencyRequest, RateLimitRequest, SlidingWindowRule, TokenBucketRule } from "../../../application/ports/rate-limiter.port";
import { MemoryRateLimiter } from "../memory-rate-limiter";
import { SECURITY_PENALTY, SECURITY_PENALTY_RESET_MS, SECURITY_PENALTY_STEPS_MS, SECURITY_STRIKE_THRESHOLD } from "../security-penalty";

const WINDOW_MS = 60_000;
const LIMIT = 3;
const MAX_KEYS = 100;
/** A window boundary, so tests start at elapsed 0. */
const WINDOW_START = WINDOW_MS * 1_000;
const HALF = 2;
const [FIRST_STEP_MS = 0, SECOND_STEP_MS = 0] = SECURITY_PENALTY_STEPS_MS;

/** A clock the test moves by hand. */
class ManualClock {
	public nowMs: number = WINDOW_START;

	public readonly now = (): number => this.nowMs;

	public advance(milliseconds: number): void {
		this.nowMs += milliseconds;
	}
}

function slidingRule(overrides: Partial<SlidingWindowRule> = {}): SlidingWindowRule {
	return { algorithm: "sliding-window", limit: LIMIT, windowMs: WINDOW_MS, penalty: null, ...overrides };
}

function request(rule: RateLimitRequest["rule"], subjectId = "203.0.113.1", failMode: RateLimitRequest["failMode"] = "closed"): RateLimitRequest {
	return { policyName: "probe", rule, subject: { kind: "ip", id: subjectId }, cost: 1, failMode };
}

async function consumeTimes(limiter: MemoryRateLimiter, times: number, rule: RateLimitRequest["rule"], subjectId?: string): Promise<boolean[]> {
	const allowed: boolean[] = [];
	for (let attempt = 0; attempt < times; attempt += 1) {
		allowed.push((await limiter.consume(request(rule, subjectId))).allowed);
	}
	return allowed;
}

describe("MemoryRateLimiter — sliding window", () => {
	it("allows the limit, refuses the next, and reports what is left", async () => {
		const clock = new ManualClock();
		const limiter = new MemoryRateLimiter({ maxKeys: MAX_KEYS, now: clock.now });

		const first = await limiter.consume(request(slidingRule()));
		expect(first).toMatchObject({ allowed: true, limit: LIMIT, remaining: LIMIT - 1, resetAfterMs: WINDOW_MS, retryAfterMs: 0, penalized: false });
		expect(await consumeTimes(limiter, LIMIT, slidingRule())).toEqual([true, true, false]);
	});

	it("weights the previous window, so a burst at a window edge cannot double the limit", async () => {
		const clock = new ManualClock();
		const limiter = new MemoryRateLimiter({ maxKeys: MAX_KEYS, now: clock.now });
		clock.advance(WINDOW_MS - 1);
		expect(await consumeTimes(limiter, LIMIT, slidingRule())).toEqual([true, true, true]);
		clock.advance(1);

		// A fixed window would allow three more now; the previous window still weighs almost fully.
		const refused = await limiter.consume(request(slidingRule()));
		expect(refused.allowed).toBe(false);
		expect(refused.retryAfterMs).toBeGreaterThan(0);

		clock.advance(WINDOW_MS / HALF);
		// Half the previous window's three still count (1.5), so one more fits, not two.
		expect(await consumeTimes(limiter, HALF, slidingRule())).toEqual([true, false]);
	});

	it("keeps subjects and policies apart", async () => {
		const limiter = new MemoryRateLimiter({ maxKeys: MAX_KEYS, now: new ManualClock().now });
		await consumeTimes(limiter, LIMIT + 1, slidingRule(), "203.0.113.1");
		expect((await limiter.consume(request(slidingRule(), "203.0.113.2"))).allowed).toBe(true);
		expect((await limiter.consume({ ...request(slidingRule(), "203.0.113.1"), policyName: "other" })).allowed).toBe(true);
	});

	it("charges a call's cost", async () => {
		const limiter = new MemoryRateLimiter({ maxKeys: MAX_KEYS, now: new ManualClock().now });
		expect((await limiter.consume({ ...request(slidingRule()), cost: LIMIT })).allowed).toBe(true);
		expect((await limiter.consume(request(slidingRule()))).allowed).toBe(false);
	});

	it("at capacity refuses a NEW subject when closed and lets it through when open", async () => {
		const limiter = new MemoryRateLimiter({ maxKeys: 1, now: new ManualClock().now });
		await limiter.consume(request(slidingRule(), "203.0.113.1"));
		expect((await limiter.consume(request(slidingRule(), "203.0.113.2", "closed"))).allowed).toBe(false);
		expect((await limiter.consume(request(slidingRule(), "203.0.113.2", "open"))).allowed).toBe(true);
	});
});

describe("MemoryRateLimiter — security penalty", () => {
	const penalized = slidingRule({ penalty: SECURITY_PENALTY });

	it("starts the first step after the strike threshold, then the next step on the next round", async () => {
		const clock = new ManualClock();
		const limiter = new MemoryRateLimiter({ maxKeys: MAX_KEYS, now: clock.now });
		await consumeTimes(limiter, LIMIT + SECURITY_STRIKE_THRESHOLD - 1, penalized);

		const third = await limiter.consume(request(penalized));
		expect(third).toMatchObject({ allowed: false, penalized: true, retryAfterMs: FIRST_STEP_MS });
		expect(await limiter.consume(request(penalized))).toMatchObject({ allowed: false, penalized: true });

		clock.advance(FIRST_STEP_MS);
		await consumeTimes(limiter, LIMIT + SECURITY_STRIKE_THRESHOLD - 1, penalized);
		expect(await limiter.consume(request(penalized))).toMatchObject({ allowed: false, penalized: true, retryAfterMs: SECOND_STEP_MS });
	});

	it("forgets the step after a quiet reset period", async () => {
		const clock = new ManualClock();
		const limiter = new MemoryRateLimiter({ maxKeys: MAX_KEYS, now: clock.now });
		await consumeTimes(limiter, LIMIT + SECURITY_STRIKE_THRESHOLD, penalized);
		clock.advance(SECURITY_PENALTY_RESET_MS + 1);

		await consumeTimes(limiter, LIMIT + SECURITY_STRIKE_THRESHOLD - 1, penalized);
		expect(await limiter.consume(request(penalized))).toMatchObject({ penalized: true, retryAfterMs: FIRST_STEP_MS });
	});

	it("lifts a penalty and its step count", async () => {
		const clock = new ManualClock();
		const limiter = new MemoryRateLimiter({ maxKeys: MAX_KEYS, now: clock.now });
		await consumeTimes(limiter, LIMIT + SECURITY_STRIKE_THRESHOLD, penalized);
		await limiter.liftPenalty("probe", { kind: "ip", id: "203.0.113.1" });
		clock.advance(WINDOW_MS * HALF);

		expect((await limiter.consume(request(penalized))).allowed).toBe(true);
	});

	it("never penalizes a policy without a penalty rule", async () => {
		const limiter = new MemoryRateLimiter({ maxKeys: MAX_KEYS, now: new ManualClock().now });
		await consumeTimes(limiter, LIMIT + SECURITY_STRIKE_THRESHOLD, slidingRule());
		expect(await limiter.consume(request(slidingRule()))).toMatchObject({ allowed: false, penalized: false, retryAfterMs: WINDOW_MS });
	});
});

describe("MemoryRateLimiter — token bucket", () => {
	const RATE_PER_SECOND = 2;
	const BURST = 4;
	const MS_PER_SECOND = 1_000;
	const bucket: TokenBucketRule = { algorithm: "token-bucket", ratePerSecond: RATE_PER_SECOND, burst: BURST };

	it("allows the burst at once, then one unit per emission interval", async () => {
		const clock = new ManualClock();
		const limiter = new MemoryRateLimiter({ maxKeys: MAX_KEYS, now: clock.now });
		expect(await consumeTimes(limiter, BURST + 1, bucket)).toEqual([true, true, true, true, false]);

		const refused = await limiter.consume(request(bucket));
		expect(refused.retryAfterMs).toBe(MS_PER_SECOND / RATE_PER_SECOND);
		clock.advance(MS_PER_SECOND / RATE_PER_SECOND);
		expect(await consumeTimes(limiter, HALF, bucket)).toEqual([true, false]);
	});
});

describe("MemoryRateLimiter — concurrency", () => {
	const LEASE_MS = 30_000;

	it("allows the limit at once, frees a slot on release, and expires a lost lease", async () => {
		const clock = new ManualClock();
		const limiter = new MemoryRateLimiter({ maxKeys: MAX_KEYS, now: clock.now });
		const concurrency: ConcurrencyRequest = {
			policyName: "export",
			rule: { algorithm: "concurrency", limit: 1, leaseMs: LEASE_MS },
			subject: { kind: "principal", id: "user:1" },
			failMode: "closed",
		};

		const first = await limiter.acquire(concurrency);
		expect(first.acquired).toBe(true);
		expect(await limiter.acquire(concurrency)).toEqual({ acquired: false, retryAfterMs: LEASE_MS });
		if (first.acquired) {
			await limiter.release(first.lease);
		}
		expect((await limiter.acquire(concurrency)).acquired).toBe(true);

		clock.advance(LEASE_MS);
		expect((await limiter.acquire(concurrency)).acquired).toBe(true);
	});
});
