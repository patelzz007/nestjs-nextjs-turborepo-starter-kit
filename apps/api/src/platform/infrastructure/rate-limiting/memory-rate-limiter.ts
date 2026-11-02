// ============================================
// platform/infrastructure/rate-limiting/memory-rate-limiter.ts — the in-process rate limiter
// ============================================
// The same algorithms as the Redis scripts, counted in this process only: the store when there is no
// Redis (a single local process) and the fallback while Redis cannot answer. Every store is bounded;
// when one is full a NEW subject is refused under `failMode: "closed"` and let through under `"open"`.

import { randomUUID } from "node:crypto";

import { BoundedTtlCache } from "@workspace/shared";

import type {
	ConcurrencyDecision,
	ConcurrencyLease,
	ConcurrencyRequest,
	RateLimitDecision,
	RateLimiter,
	RateLimitFailMode,
	RateLimitRequest,
	RateLimitSubject,
	SlidingWindowRule,
	TokenBucketRule,
} from "../../application/ports/rate-limiter.port";

const MS_PER_SECOND = 1_000;

/** Sliding-window counters live two windows (the current one is the next one's "previous"). */
const WINDOWS_KEPT = 2;

export interface MemoryRateLimiterOptions {
	readonly maxKeys: number;
	readonly now?: () => number;
}

function familyKey(policyName: string, subject: RateLimitSubject): string {
	return `${policyName}:${subject.kind}:${subject.id}`;
}

export class MemoryRateLimiter implements RateLimiter {
	private readonly windows: BoundedTtlCache<string, number>;
	private readonly penalties: BoundedTtlCache<string, number>;
	private readonly strikes: BoundedTtlCache<string, number>;
	private readonly levels: BoundedTtlCache<string, number>;
	private readonly buckets: BoundedTtlCache<string, number>;
	private readonly leases: BoundedTtlCache<string, Map<string, number>>;
	private readonly now: () => number;

	public constructor(options: MemoryRateLimiterOptions) {
		const bounded = (): { maxEntries: number; capacityPolicy: "reject-new" } => ({ maxEntries: options.maxKeys, capacityPolicy: "reject-new" });
		this.windows = new BoundedTtlCache<string, number>(bounded());
		this.penalties = new BoundedTtlCache<string, number>(bounded());
		this.strikes = new BoundedTtlCache<string, number>(bounded());
		this.levels = new BoundedTtlCache<string, number>(bounded());
		this.buckets = new BoundedTtlCache<string, number>(bounded());
		this.leases = new BoundedTtlCache<string, Map<string, number>>(bounded());
		this.now = options.now ?? Date.now;
	}

	public consume(request: RateLimitRequest): Promise<RateLimitDecision> {
		const family = familyKey(request.policyName, request.subject);
		return Promise.resolve(
			request.rule.algorithm === "sliding-window"
				? this.consumeSlidingWindow(family, request.rule, request.cost, request.failMode)
				: this.consumeTokenBucket(family, request.rule, request.cost, request.failMode),
		);
	}

	public acquire(request: ConcurrencyRequest): Promise<ConcurrencyDecision> {
		return Promise.resolve(this.acquireNow(request));
	}

	public release(lease: ConcurrencyLease): Promise<void> {
		this.leases.get(familyKey(lease.policyName, lease.subject), this.now())?.delete(lease.leaseId);
		return Promise.resolve();
	}

	public liftPenalty(policyName: string, subject: RateLimitSubject): Promise<void> {
		const family = familyKey(policyName, subject);
		this.penalties.delete(family);
		this.strikes.delete(family);
		this.levels.delete(family);
		return Promise.resolve();
	}

	private acquireNow(request: ConcurrencyRequest): ConcurrencyDecision {
		const now = this.now();
		const family = familyKey(request.policyName, request.subject);
		const live = new Map<string, number>([...(this.leases.get(family, now) ?? new Map<string, number>())].filter(([, expiresAt]): boolean => expiresAt > now));
		if (live.size >= request.rule.limit) {
			const soonest = Math.min(...live.values());
			return { acquired: false, retryAfterMs: Math.max(1, soonest - now) };
		}
		const leaseId = randomUUID();
		live.set(leaseId, now + request.rule.leaseMs);
		if (!this.leases.set(family, live, request.rule.leaseMs, now) && request.failMode === "closed") {
			return { acquired: false, retryAfterMs: request.rule.leaseMs };
		}
		return { acquired: true, lease: { policyName: request.policyName, subject: request.subject, leaseId } };
	}

	private consumeSlidingWindow(family: string, rule: SlidingWindowRule, cost: number, failMode: RateLimitFailMode): RateLimitDecision {
		const now = this.now();
		const refused = (resetAfterMs: number, retryAfterMs: number, penalized: boolean): RateLimitDecision => ({
			allowed: false,
			limit: rule.limit,
			remaining: 0,
			resetAfterMs,
			retryAfterMs,
			penalized,
		});
		if (rule.penalty !== null) {
			const penaltyEndsAt = this.penalties.get(family, now);
			if (penaltyEndsAt !== null && penaltyEndsAt > now) {
				return refused(penaltyEndsAt - now, penaltyEndsAt - now, true);
			}
		}
		const window = Math.floor(now / rule.windowMs);
		const elapsed = now - window * rule.windowMs;
		const resetAfterMs = rule.windowMs - elapsed;
		const current = this.windows.get(`${family}:${String(window)}`, now) ?? 0;
		const previous = this.windows.get(`${family}:${String(window - 1)}`, now) ?? 0;
		const used = previous * (resetAfterMs / rule.windowMs) + current;
		if (used + cost > rule.limit) {
			const room = rule.limit - current - cost;
			const retry = previous > 0 && room >= 0 ? Math.ceil(rule.windowMs * (1 - room / previous)) - elapsed : resetAfterMs;
			const penaltyMs = this.strike(family, rule, now);
			return penaltyMs === null ? refused(resetAfterMs, Math.max(1, retry), false) : refused(penaltyMs, penaltyMs, true);
		}
		const stored = this.windows.set(`${family}:${String(window)}`, current + cost, rule.windowMs * WINDOWS_KEPT, now);
		if (!stored && failMode === "closed") {
			return refused(resetAfterMs, resetAfterMs, false);
		}
		return { allowed: true, limit: rule.limit, remaining: Math.floor(rule.limit - used - cost), resetAfterMs, retryAfterMs: 0, penalized: false };
	}

	/** Records one refusal; returns the penalty's length when this refusal starts one. */
	private strike(family: string, rule: SlidingWindowRule, now: number): number | null {
		const penalty = rule.penalty;
		if (penalty === null) {
			return null;
		}
		const strikes = (this.strikes.get(family, now) ?? 0) + 1;
		const level = this.levels.get(family, now);
		if (level !== null) {
			this.levels.set(family, level, penalty.resetAfterMs, now);
		}
		if (strikes < penalty.strikeThreshold) {
			this.strikes.set(family, strikes, penalty.strikeWindowMs, now);
			return null;
		}
		const nextLevel = Math.min((level ?? 0) + 1, penalty.stepsMs.length);
		this.levels.set(family, nextLevel, penalty.resetAfterMs, now);
		this.strikes.delete(family);
		const duration = penalty.stepsMs.at(nextLevel - 1) ?? penalty.resetAfterMs;
		this.penalties.set(family, now + duration, duration, now);
		return duration;
	}

	private consumeTokenBucket(family: string, rule: TokenBucketRule, cost: number, failMode: RateLimitFailMode): RateLimitDecision {
		const now = this.now();
		const emissionMs = MS_PER_SECOND / rule.ratePerSecond;
		const tat = Math.max(this.buckets.get(family, now) ?? now, now);
		const tolerance = emissionMs * rule.burst;
		const newTat = tat + emissionMs * cost;
		const allowAt = newTat - tolerance;
		if (allowAt > now) {
			return { allowed: false, limit: rule.burst, remaining: 0, resetAfterMs: Math.ceil(tat - now), retryAfterMs: Math.ceil(allowAt - now), penalized: false };
		}
		const stored = this.buckets.set(family, newTat, Math.max(1, Math.ceil(newTat - now)), now);
		if (!stored && failMode === "closed") {
			return { allowed: false, limit: rule.burst, remaining: 0, resetAfterMs: Math.ceil(emissionMs), retryAfterMs: Math.ceil(emissionMs), penalized: false };
		}
		return {
			allowed: true,
			limit: rule.burst,
			remaining: Math.floor((tolerance - (newTat - now)) / emissionMs),
			resetAfterMs: Math.ceil(newTat - now),
			retryAfterMs: 0,
			penalized: false,
		};
	}
}
