import { z } from "zod";

import { BaseResponseSchema, EpochMsSchema } from "../../../schemas/api/common";

// ── Rate limits (ADR 071) and the cache (ADR 072) in the admin Operations console ──────────────

export const RateLimitAlgorithmSchema = z.enum(["sliding-window", "token-bucket", "concurrency"]);
export type RateLimitAlgorithm = z.output<typeof RateLimitAlgorithmSchema>;

export const RateLimitSubjectKindSchema = z.enum(["ip", "principal", "tenant", "apiKey", "destination"]);
export type RateLimitSubjectKind = z.output<typeof RateLimitSubjectKindSchema>;

/** The tenant policies a tenant override can change. */
export const TenantRateLimitPolicyNameSchema = z.enum(["TENANT_TRAFFIC", "API_KEY_TRAFFIC", "TENANT_BROADCASTS"]);
export type TenantRateLimitPolicyName = z.output<typeof TenantRateLimitPolicyNameSchema>;

export const RateLimitPolicySummarySchema = z.object({
	name: z.string(),
	algorithm: RateLimitAlgorithmSchema,
	subject: RateLimitSubjectKindSchema,
	/** A human description of the limit: "5 per 1 min", "50/s, burst 200", "2 at once". */
	limit: z.string(),
	failMode: z.enum(["closed", "open"]),
	penalty: z.boolean(),
	refusedLastHour: z.number().int().nonnegative(),
	/** Refusals per 10-minute bucket over the last hour, oldest first. */
	refusalsByTenMinutes: z.array(z.number().int().nonnegative()),
});
export type RateLimitPolicySummary = z.output<typeof RateLimitPolicySummarySchema>;

export const RateLimitedSubjectSchema = z.object({
	policyName: z.string(),
	subjectKind: RateLimitSubjectKindSchema,
	/** Masked: `203.0.113.•`, `user:0193ab12•`. */
	maskedSubject: z.string(),
	/** Opaque: names the subject to "Lift penalty" for a day, without revealing it. */
	subjectRef: z.string(),
	refusals: z.number().int().positive(),
	penalized: z.boolean(),
	lastRefusedAt: EpochMsSchema,
});
export type RateLimitedSubject = z.output<typeof RateLimitedSubjectSchema>;

export const RateLimitExemptionSchema = z.object({ kind: z.enum(["load-test", "server-agent", "cidr"]), label: z.string() });
export type RateLimitExemption = z.output<typeof RateLimitExemptionSchema>;

export const RateLimitsOverviewSchema = z.object({
	policies: z.array(RateLimitPolicySummarySchema),
	topSubjects: z.array(RateLimitedSubjectSchema),
	exemptions: z.array(RateLimitExemptionSchema),
});
export type RateLimitsOverview = z.output<typeof RateLimitsOverviewSchema>;

const MS_PER_SECOND = 1_000;
/** Seven days: the broadcast allowance is per week (ADR 073). */
export const RATE_LIMIT_WEEK_MS = 7 * 24 * 60 * 60 * MS_PER_SECOND;

/**
 * A token bucket as one pair: at most `limit` within `windowMs`, refilling evenly. Traffic reads as a rate
 * and a burst (50/s, burst 200 = 200 per 4 s); the broadcast allowance as a count per week (5 per 7 days).
 */
export interface RateLimitAllowance {
	readonly limit: number;
	readonly windowMs: number;
}

export const TenantRateLimitOverrideSchema = BaseResponseSchema.extend({
	id: z.uuid(),
	tenantId: z.uuid(),
	tenantName: z.string(),
	policyName: TenantRateLimitPolicyNameSchema,
	limit: z.number().int().positive(),
	windowMs: z.number().int().positive(),
	reason: z.string(),
	expiresAt: EpochMsSchema,
	setByUserId: z.uuid(),
});
export type TenantRateLimitOverride = z.output<typeof TenantRateLimitOverrideSchema>;

/** `GET /admin/operations/rate-limits/overrides`. */
export const TenantRateLimitOverrideListSchema = z.array(TenantRateLimitOverrideSchema);

/** Rates, bursts and weekly counts an override may set (a sanity bound, not a plan). */
export const RATE_LIMIT_OVERRIDE_MAX_RATE_PER_SECOND = 10_000;
export const RATE_LIMIT_OVERRIDE_MAX_BURST = 100_000;
export const RATE_LIMIT_OVERRIDE_MAX_PER_WEEK = 100;

const OVERRIDE_COMMON_SHAPE = {
	tenantId: z.uuid(),
	reason: z.string().trim().min(10).max(500),
	expiresAt: EpochMsSchema,
};

/** Each policy in its own units: traffic as a rate and a burst, the broadcast allowance per week. */
export const SetTenantRateLimitOverrideSchema = z.discriminatedUnion("policyName", [
	z
		.object({
			...OVERRIDE_COMMON_SHAPE,
			policyName: z.enum(["TENANT_TRAFFIC", "API_KEY_TRAFFIC"]),
			ratePerSecond: z.number().int().min(1).max(RATE_LIMIT_OVERRIDE_MAX_RATE_PER_SECOND),
			burst: z.number().int().min(1).max(RATE_LIMIT_OVERRIDE_MAX_BURST),
		})
		.strict()
		.refine((input): boolean => input.burst >= input.ratePerSecond, { message: "The burst is at least one second's worth of the rate", path: ["burst"] }),
	z.object({ ...OVERRIDE_COMMON_SHAPE, policyName: z.literal("TENANT_BROADCASTS"), perWeek: z.number().int().min(1).max(RATE_LIMIT_OVERRIDE_MAX_PER_WEEK) }).strict(),
]);
export type SetTenantRateLimitOverrideInput = z.output<typeof SetTenantRateLimitOverrideSchema>;

/** The stored pair of an override, from the units it was set in. */
export function overrideAllowance(input: SetTenantRateLimitOverrideInput): RateLimitAllowance {
	return input.policyName === "TENANT_BROADCASTS"
		? { limit: input.perWeek, windowMs: RATE_LIMIT_WEEK_MS }
		: { limit: input.burst, windowMs: Math.round((input.burst / input.ratePerSecond) * MS_PER_SECOND) };
}

/** An allowance as people read it: "50/s, burst 200" for traffic, "5 per week" for broadcasts. */
export function describeRateLimitAllowance(policyName: TenantRateLimitPolicyName, allowance: RateLimitAllowance): string {
	if (policyName === "TENANT_BROADCASTS") {
		return `${String(allowance.limit)} per week`;
	}
	const perSecond = (allowance.limit * MS_PER_SECOND) / allowance.windowMs;
	return `${String(Math.round(perSecond))}/s, burst ${String(allowance.limit)}`;
}

/** Lift a penalty from the overview's row: its opaque subject reference, and why (audited). */
export const LiftRateLimitPenaltySchema = z.object({ subjectRef: z.string().regex(/^[0-9a-f]{32}$/), reason: z.string().trim().min(10).max(500) }).strict();
export type LiftRateLimitPenaltyInput = z.output<typeof LiftRateLimitPenaltySchema>;

export const CacheTierSchema = z.enum(["local", "shared", "two-tier"]);
export const CacheScopeSchema = z.enum(["tenant", "user", "platform"]);

export const CacheNamespaceSummarySchema = z.object({
	name: z.string(),
	version: z.number().int().positive(),
	tier: CacheTierSchema,
	scope: CacheScopeSchema,
	encrypted: z.boolean(),
	ttlMs: z.number().int().positive(),
	/** On the instance that answered. */
	localEntries: z.number().int().nonnegative(),
	sharedKeys: z.number().int().nonnegative().nullable(),
	sharedMaxKeys: z.number().int().positive(),
	hits: z.number().int().nonnegative(),
	misses: z.number().int().nonnegative(),
	staleServed: z.number().int().nonnegative(),
	loadFailures: z.number().int().nonnegative(),
	refusedWrites: z.number().int().nonnegative(),
	/** hits / (hits + misses) on this instance since it started; null before any read. */
	hitRatio: z.number().min(0).max(1).nullable(),
});
export type CacheNamespaceSummary = z.output<typeof CacheNamespaceSummarySchema>;

export const CacheOverviewSchema = z.object({
	namespaces: z.array(CacheNamespaceSummarySchema),
	redis: z
		.object({
			usedBytes: z.number().int().nonnegative(),
			maxBytes: z.number().int().positive().nullable(),
			policy: z.string(),
			/** Percent of maxmemory at which health reports the cache degraded. */
			alertPercent: z.number().int().positive(),
			/** Queues and cache share one Redis: it must never evict. */
			policyOk: z.boolean(),
		})
		.nullable(),
	circuitOpen: z.boolean(),
});
export type CacheOverview = z.output<typeof CacheOverviewSchema>;

export const FlushCacheSchema = z.discriminatedUnion("target", [
	z.object({ target: z.literal("namespace"), name: z.string().min(1).max(96), reason: z.string().trim().min(10).max(500) }).strict(),
	z.object({ target: z.literal("tenant"), tenantId: z.uuid(), reason: z.string().trim().min(10).max(500) }).strict(),
]);
export type FlushCacheInput = z.output<typeof FlushCacheSchema>;
