import type { z } from "zod";
import type { RateLimitSubjectKindSchema } from "@workspace/shared";

/*
 * The one rate limiter every limit in the API goes through (ADR 071): the HTTP throttlers, the email
 * recipient cap, the analytics export cap and the notification channel caps. Each decision is atomic
 * in the shared store, so a counter can never be left without its expiry.
 */

/** Who or what a policy counts. A `destination` id is always a SHA-256 of the normalized address, never the address. */
export type RateLimitSubjectKind = z.output<typeof RateLimitSubjectKindSchema>;

export interface RateLimitSubject {
	readonly kind: RateLimitSubjectKind;
	readonly id: string;
}

/**
 * Growing refusals for a subject that keeps hitting a security policy: `strikeThreshold` refusals inside
 * `strikeWindowMs` start the next step of `stepsMs` (the last step repeats); the step count resets after
 * `resetAfterMs` without a refusal.
 */
export interface PenaltyRule {
	readonly strikeThreshold: number;
	readonly strikeWindowMs: number;
	readonly stepsMs: readonly number[];
	readonly resetAfterMs: number;
}

/** At most `limit` per rolling `windowMs` (the previous window weighted by its overlap). */
export interface SlidingWindowRule {
	readonly algorithm: "sliding-window";
	readonly limit: number;
	readonly windowMs: number;
	readonly penalty: PenaltyRule | null;
}

/** A steady `ratePerSecond` with room for `burst` at once (GCRA). */
export interface TokenBucketRule {
	readonly algorithm: "token-bucket";
	readonly ratePerSecond: number;
	readonly burst: number;
}

export type CountingRule = SlidingWindowRule | TokenBucketRule;

/** At most `limit` running at once; a lease the holder never releases expires after `leaseMs`. */
export interface ConcurrencyRule {
	readonly algorithm: "concurrency";
	readonly limit: number;
	readonly leaseMs: number;
}

/**
 * What happens when the shared store cannot answer: `closed` (security) counts in a bounded local store
 * that refuses new subjects when full; `open` (general traffic) counts locally with the limit divided by
 * the expected number of instances.
 */
export type RateLimitFailMode = "closed" | "open";

export interface RateLimitRequest {
	/** The policy's name: a key segment and the name logged with every refusal. */
	readonly policyName: string;
	readonly rule: CountingRule;
	readonly subject: RateLimitSubject;
	/** How many units this call uses (an expensive export may cost more than one). */
	readonly cost: number;
	readonly failMode: RateLimitFailMode;
}

export interface RateLimitDecision {
	readonly allowed: boolean;
	/** The policy's limit (`burst` for a token bucket). */
	readonly limit: number;
	/** What is left after this call; 0 when refused. */
	readonly remaining: number;
	/** Milliseconds until the count is back to zero use. */
	readonly resetAfterMs: number;
	/** Milliseconds until a refused caller may try again (0 when allowed). */
	readonly retryAfterMs: number;
	/** Whether the refusal is a penalty (not just the window being full). */
	readonly penalized: boolean;
}

export interface ConcurrencyRequest {
	readonly policyName: string;
	readonly rule: ConcurrencyRule;
	readonly subject: RateLimitSubject;
	readonly failMode: RateLimitFailMode;
}

export interface ConcurrencyLease {
	readonly policyName: string;
	readonly subject: RateLimitSubject;
	readonly leaseId: string;
}

export type ConcurrencyDecision = { readonly acquired: true; readonly lease: ConcurrencyLease } | { readonly acquired: false; readonly retryAfterMs: number };

export interface RateLimiter {
	consume(request: RateLimitRequest): Promise<RateLimitDecision>;
	acquire(request: ConcurrencyRequest): Promise<ConcurrencyDecision>;
	release(lease: ConcurrencyLease): Promise<void>;
	/** Ends a running penalty and its step count for one subject (an audited admin action). */
	liftPenalty(policyName: string, subject: RateLimitSubject): Promise<void>;
}

export const RATE_LIMITER = Symbol("RATE_LIMITER");
