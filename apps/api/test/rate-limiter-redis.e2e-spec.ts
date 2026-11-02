import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type Redis from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TypedConfigService } from "../src/config/typed-config.service";
import type { ConcurrencyRequest, RateLimitRequest, RateLimitSubject } from "../src/platform/application/ports/rate-limiter.port";
import { rateLimitKeyFamily } from "../src/platform/infrastructure/rate-limiting/rate-limit-keys";
import { RateLimitRefusalLog } from "../src/platform/infrastructure/rate-limiting/rate-limit-refusal-log";
import { ioredisScriptClient, RedisRateLimiter } from "../src/platform/infrastructure/rate-limiting/redis-rate-limiter";
import { SECURITY_PENALTY, SECURITY_PENALTY_STEPS_MS, SECURITY_STRIKE_THRESHOLD } from "../src/platform/infrastructure/rate-limiting/security-penalty";
import { REDIS_PUBLISHER } from "../src/platform/infrastructure/redis/redis.tokens";
import { createE2eApp } from "./e2e-helpers";

const LIMIT = 3;
const WINDOW_MS = 60_000;
const BURST = 4;
const RATE_PER_SECOND = 1;
const LEASE_MS = 30_000;
const [FIRST_STEP_MS = 0] = SECURITY_PENALTY_STEPS_MS;

/**
 * The Lua scripts against the real Redis (ADR 071): the same behaviour the in-process limiter's unit
 * tests prove, plus what only Redis can show — every key a decision writes has an expiry, so a subject
 * can never stay refused for ever (the INCR-then-PEXPIRE bug this replaced).
 */
describe("RedisRateLimiter against Redis (e2e)", () => {
	let app: NestFastifyApplication;
	let redis: Redis;
	let limiter: RedisRateLimiter;
	let config: TypedConfigService;

	beforeAll(async () => {
		app = await createE2eApp();
		const publisher = app.get<Redis | null>(REDIS_PUBLISHER, { strict: false });
		if (publisher === null) {
			throw new Error("The rate-limiter e2e suite needs REDIS_URL (CI and `pnpm docker:up` provide it)");
		}
		redis = publisher;
		config = app.get(TypedConfigService);
		limiter = new RedisRateLimiter(ioredisScriptClient(redis), config.redisNamespace);
	});

	afterAll(async () => {
		await app.close();
	});

	function freshSubject(): RateLimitSubject {
		return { kind: "ip", id: `e2e-${randomUUID()}` };
	}

	function sliding(subject: RateLimitSubject, penalty: boolean): RateLimitRequest {
		return {
			policyName: "e2e-sliding",
			rule: { algorithm: "sliding-window", limit: LIMIT, windowMs: WINDOW_MS, penalty: penalty ? SECURITY_PENALTY : null },
			subject,
			cost: 1,
			failMode: "closed",
		};
	}

	async function keysWithoutExpiry(subject: RateLimitSubject, policyName: string): Promise<string[]> {
		const pattern = config.redisNamespace.scanPattern(`rl:{${policyName}:${subject.kind}:${subject.id}}`);
		const keys = await redis.keys(pattern);
		const ttls = await Promise.all(keys.map((key: string): Promise<number> => redis.pttl(key)));
		return keys.filter((_key: string, index: number): boolean => (ttls.at(index) ?? -1) <= 0);
	}

	it("allows the limit in a rolling window, refuses the next, and leaves no key without an expiry", async () => {
		const subject = freshSubject();
		const allowed: boolean[] = [];
		for (let attempt = 0; attempt <= LIMIT; attempt += 1) {
			allowed.push((await limiter.consume(sliding(subject, false))).allowed);
		}
		expect(allowed).toEqual([true, true, true, false]);
		expect(await keysWithoutExpiry(subject, "e2e-sliding")).toEqual([]);
	});

	it("starts the first penalty step after the strike threshold, with the penalty key expiring by itself", async () => {
		const subject = freshSubject();
		for (let attempt = 0; attempt < LIMIT + SECURITY_STRIKE_THRESHOLD - 1; attempt += 1) {
			await limiter.consume(sliding(subject, true));
		}
		const penalized = await limiter.consume(sliding(subject, true));
		expect(penalized).toMatchObject({ allowed: false, penalized: true, retryAfterMs: FIRST_STEP_MS });

		const penaltyTtl = await redis.pttl(rateLimitKeyFamily(config.redisNamespace, "e2e-sliding", subject).penalty);
		expect(penaltyTtl).toBeGreaterThan(0);
		expect(penaltyTtl).toBeLessThanOrEqual(FIRST_STEP_MS);
		expect(await keysWithoutExpiry(subject, "e2e-sliding")).toEqual([]);

		await limiter.liftPenalty("e2e-sliding", subject);
		expect(await redis.exists(rateLimitKeyFamily(config.redisNamespace, "e2e-sliding", subject).penalty)).toBe(0);
	});

	it("lets a token bucket's burst through at once, then refuses with the wait for one unit", async () => {
		const subject = freshSubject();
		const request: RateLimitRequest = {
			policyName: "e2e-bucket",
			rule: { algorithm: "token-bucket", ratePerSecond: RATE_PER_SECOND, burst: BURST },
			subject,
			cost: 1,
			failMode: "open",
		};
		const allowed: boolean[] = [];
		for (let attempt = 0; attempt <= BURST; attempt += 1) {
			allowed.push((await limiter.consume(request)).allowed);
		}
		expect(allowed).toEqual([true, true, true, true, false]);
		const refused = await limiter.consume(request);
		expect(refused.retryAfterMs).toBeGreaterThan(0);
		expect(await keysWithoutExpiry(subject, "e2e-bucket")).toEqual([]);
	});

	it("holds at most the concurrency limit of leases, and frees one on release", async () => {
		const subject = freshSubject();
		const request: ConcurrencyRequest = { policyName: "e2e-concurrency", rule: { algorithm: "concurrency", limit: 1, leaseMs: LEASE_MS }, subject, failMode: "closed" };
		const first = await limiter.acquire(request);
		expect(first.acquired).toBe(true);
		const second = await limiter.acquire(request);
		expect(second.acquired).toBe(false);
		if (first.acquired) {
			await limiter.release(first.lease);
		}
		expect((await limiter.acquire(request)).acquired).toBe(true);
		expect(await keysWithoutExpiry(subject, "e2e-concurrency")).toEqual([]);
	});

	it("lifts a penalty through the refusal log's opaque reference, which resolves only while it lasts", async () => {
		const refusals = app.get(RateLimitRefusalLog);
		const subject = freshSubject();
		const request = sliding(subject, true);
		for (let attempt = 0; attempt < LIMIT + SECURITY_STRIKE_THRESHOLD; attempt += 1) {
			const decision = await limiter.consume(request);
			if (!decision.allowed) {
				await refusals.record({ policyName: request.policyName, subject, penalized: decision.penalized });
			}
		}
		expect((await limiter.consume(request)).penalized).toBe(true);

		const [latest] = await refusals.recent(0, 1);
		expect(latest?.maskedSubject).not.toContain(subject.id);
		const ref = latest?.subjectRef ?? "";
		expect(await refusals.resolveSubject(ref)).toEqual({ policyName: request.policyName, subject });
		expect(await redis.ttl(config.redisNamespace.key(`rl:ref:${ref}`))).toBeGreaterThan(0);

		await limiter.liftPenalty(request.policyName, subject);
		expect((await limiter.consume(request)).penalized).toBe(false);
		await expect(refusals.resolveSubject("f".repeat(32))).resolves.toBeNull();
	});
});
