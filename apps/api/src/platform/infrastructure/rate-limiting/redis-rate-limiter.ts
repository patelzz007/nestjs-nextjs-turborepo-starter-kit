// ============================================
// platform/infrastructure/rate-limiting/redis-rate-limiter.ts — the shared, atomic rate limiter
// ============================================

import { randomUUID } from "node:crypto";

import type Redis from "ioredis";
import { z } from "zod";

import type {
	ConcurrencyDecision,
	ConcurrencyLease,
	ConcurrencyRequest,
	RateLimitDecision,
	RateLimiter,
	RateLimitRequest,
	RateLimitSubject,
	SlidingWindowRule,
	TokenBucketRule,
} from "../../application/ports/rate-limiter.port";
import type { RedisNamespace } from "../redis/redis-namespace";
import { rateLimitKeyFamily, type RateLimitKeyFamily } from "./rate-limit-keys";
import { CONCURRENCY_SCRIPT, SLIDING_WINDOW_SCRIPT, TOKEN_BUCKET_SCRIPT, type RateLimitScript } from "./rate-limit-scripts";

/** A script reply: Redis turns every Lua number into an integer. */
export type ScriptReply = readonly number[];

/** What the limiter needs of Redis. {@link ioredisScriptClient} adapts the shared ioredis client. */
export interface RateLimitScriptClient {
	evalsha(sha: string, keys: readonly string[], args: readonly (string | number)[]): Promise<ScriptReply>;
	eval(source: string, keys: readonly string[], args: readonly (string | number)[]): Promise<ScriptReply>;
	del(keys: readonly string[]): Promise<void>;
	zrem(key: string, member: string): Promise<void>;
}

const ScriptReplySchema = z.array(z.number());

/** Redis answers `NOSCRIPT` when the script cache does not hold the sha (a restart, a failover). */
function isNoScriptError(error: Error): boolean {
	return error.message.startsWith("NOSCRIPT");
}

/** The shared ioredis client as a {@link RateLimitScriptClient}. Replies are checked, never trusted. */
export function ioredisScriptClient(redis: Redis): RateLimitScriptClient {
	return {
		evalsha: async (sha, keys, args): Promise<ScriptReply> => ScriptReplySchema.parse(await redis.evalsha(sha, keys.length, ...keys, ...args)),
		eval: async (source, keys, args): Promise<ScriptReply> => ScriptReplySchema.parse(await redis.eval(source, keys.length, ...keys, ...args)),
		del: async (keys): Promise<void> => {
			await redis.del(...keys);
		},
		zrem: async (key, member): Promise<void> => {
			await redis.zrem(key, member);
		},
	};
}

/** Milliseconds in one second: a token bucket's rate is per second, its emission interval in ms. */
const MS_PER_SECOND = 1_000;

/** Reply slots, named (rules/27). */
interface CountingReply {
	readonly allowed: boolean;
	readonly remaining: number;
	readonly resetAfterMs: number;
	readonly retryAfterMs: number;
	readonly penalized: boolean;
}

function countingReply(reply: ScriptReply): CountingReply {
	const [allowed = 0, remaining = 0, resetAfterMs = 0, retryAfterMs = 0, penalized = 0] = reply;
	return { allowed: allowed === 1, remaining, resetAfterMs, retryAfterMs, penalized: penalized === 1 };
}

export class RedisRateLimiter implements RateLimiter {
	public constructor(
		private readonly client: RateLimitScriptClient,
		private readonly namespace: RedisNamespace,
	) {}

	public async consume(request: RateLimitRequest): Promise<RateLimitDecision> {
		const keys = rateLimitKeyFamily(this.namespace, request.policyName, request.subject);
		return request.rule.algorithm === "sliding-window"
			? this.consumeSlidingWindow(keys, request.rule, request.cost)
			: this.consumeTokenBucket(keys, request.rule, request.cost);
	}

	public async acquire(request: ConcurrencyRequest): Promise<ConcurrencyDecision> {
		const keys = rateLimitKeyFamily(this.namespace, request.policyName, request.subject);
		const leaseId = randomUUID();
		const [acquired = 0, retryAfterMs = 0] = await this.run(CONCURRENCY_SCRIPT, [keys.leases], [request.rule.limit, request.rule.leaseMs, leaseId]);
		if (acquired === 1) {
			return { acquired: true, lease: { policyName: request.policyName, subject: request.subject, leaseId } };
		}
		return { acquired: false, retryAfterMs };
	}

	public async release(lease: ConcurrencyLease): Promise<void> {
		await this.client.zrem(rateLimitKeyFamily(this.namespace, lease.policyName, lease.subject).leases, lease.leaseId);
	}

	public async liftPenalty(policyName: string, subject: RateLimitSubject): Promise<void> {
		const keys = rateLimitKeyFamily(this.namespace, policyName, subject);
		await this.client.del([keys.penalty, keys.strikes, keys.penaltyLevel]);
	}

	private async consumeSlidingWindow(keys: RateLimitKeyFamily, rule: SlidingWindowRule, cost: number): Promise<RateLimitDecision> {
		const penalty = rule.penalty;
		const penaltyArgs: readonly (string | number)[] =
			penalty === null ? ["0", 0, 0, 0, 0] : ["1", penalty.strikeThreshold, penalty.strikeWindowMs, penalty.resetAfterMs, penalty.stepsMs.length, ...penalty.stepsMs];
		const reply = countingReply(
			await this.run(SLIDING_WINDOW_SCRIPT, [keys.windowBase, keys.penalty, keys.strikes, keys.penaltyLevel], [rule.limit, rule.windowMs, cost, ...penaltyArgs]),
		);
		return { ...reply, limit: rule.limit };
	}

	private async consumeTokenBucket(keys: RateLimitKeyFamily, rule: TokenBucketRule, cost: number): Promise<RateLimitDecision> {
		const emissionMs = MS_PER_SECOND / rule.ratePerSecond;
		const reply = countingReply(await this.run(TOKEN_BUCKET_SCRIPT, [keys.bucket], [emissionMs, rule.burst, cost]));
		return { ...reply, limit: rule.burst, penalized: false };
	}

	/** EVALSHA first; on `NOSCRIPT` the source is sent once (Redis caches it again). */
	private async run(script: RateLimitScript, keys: readonly string[], args: readonly (string | number)[]): Promise<ScriptReply> {
		try {
			return await this.client.evalsha(script.sha, keys, args);
		} catch (error) {
			if (error instanceof Error && isNoScriptError(error)) {
				return this.client.eval(script.source, keys, args);
			}
			throw error;
		}
	}
}
