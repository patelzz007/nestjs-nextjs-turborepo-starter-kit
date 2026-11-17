import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";

// ── Customer tiers (ADR 085): a customer's platform-wide standing, earned by counted redemptions ──

/** The four tiers, lowest first (mirrors Prisma's `CustomerTier`; packages/shared cannot import @prisma/client). */
export const CustomerTierSchema = z.enum(["BRONZE", "SILVER", "GOLD", "DIAMOND"]);
export type CustomerTier = z.output<typeof CustomerTierSchema>;

/** Each tier's English name, as screens, notices and reports write it. */
export const CUSTOMER_TIER_LABELS: Readonly<Record<CustomerTier, string>> = { BRONZE: "Bronze", SILVER: "Silver", GOLD: "Gold", DIAMOND: "Diamond" };

/** Every new customer, and every signed-out visitor, is Bronze. */
export const ENTRY_CUSTOMER_TIER: CustomerTier = CustomerTierSchema.enum.BRONZE;

/** A tier's rank: Bronze 0 … Diamond 3. The schema's option order is the tier order. */
export function customerTierRank(tier: CustomerTier): number {
	return CustomerTierSchema.options.indexOf(tier);
}

/** Whether `tier` reaches `minimum` (Gold reaches a Silver reward; Silver does not reach a Gold one). */
export function isTierAtLeast(tier: CustomerTier, minimum: CustomerTier): boolean {
	return customerTierRank(tier) >= customerTierRank(minimum);
}

/** The tier above `tier`, or null for Diamond. */
export function nextCustomerTier(tier: CustomerTier): CustomerTier | null {
	return CustomerTierSchema.options.at(customerTierRank(tier) + 1) ?? null;
}

/** Why a customer's tier changed (mirrors Prisma's `CustomerTierChangeReason`). */
export const CustomerTierChangeReasonSchema = z.enum(["PROMOTION", "DEMOTION"]);
export type CustomerTierChangeReason = z.output<typeof CustomerTierChangeReasonSchema>;

// ── Tier settings: one row for the whole platform, edited by platform staff ──

const MIN_THRESHOLD = 1;
const MAX_THRESHOLD = 10_000;
const MIN_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 1_095;
const MIN_MERCHANT_CAP = 1;
const MAX_MERCHANT_CAP = 10_000;
const MIN_HOLD_DAYS = 0;
const MAX_HOLD_DAYS = 365;
const MIN_WARNING_DAYS = 1;
const MAX_WARNING_DAYS = 90;
const REASON_MIN_LENGTH = 10;
const REASON_MAX_LENGTH = 500;

const ThresholdSchema = z.number().int().min(MIN_THRESHOLD).max(MAX_THRESHOLD);

const tierRulesShape = {
	/** Counted redemptions in the tier window that reach Silver, Gold and Diamond. Strictly increasing. */
	silverThreshold: ThresholdSchema,
	goldThreshold: ThresholdSchema,
	diamondThreshold: ThresholdSchema,
	/** The tier window: the rolling number of days, ending today, whose counted redemptions decide a tier. */
	windowDays: z.number().int().min(MIN_WINDOW_DAYS).max(MAX_WINDOW_DAYS),
	/** At most this many redemptions from any one merchant count inside one tier window. */
	perMerchantCap: z.number().int().min(MIN_MERCHANT_CAP).max(MAX_MERCHANT_CAP),
	/** Days after a promotion during which the customer cannot be demoted below the tier they reached. */
	holdDays: z.number().int().min(MIN_HOLD_DAYS).max(MAX_HOLD_DAYS),
	/** Days of warning a customer gets before a demotion takes effect. */
	warningDays: z.number().int().min(MIN_WARNING_DAYS).max(MAX_WARNING_DAYS),
};

/** The tier rules as the domain reads them. */
export const TierRulesSchema = z.object(tierRulesShape).strict().superRefine(refineIncreasingThresholds);
export type TierRules = z.output<typeof TierRulesSchema>;

interface TierThresholds {
	readonly silverThreshold: number;
	readonly goldThreshold: number;
	readonly diamondThreshold: number;
}

/** Silver < Gold < Diamond: a higher tier always needs more counted redemptions. */
function refineIncreasingThresholds(value: TierThresholds, ctx: z.RefinementCtx): void {
	if (value.goldThreshold <= value.silverThreshold) {
		ctx.addIssue({ code: "custom", message: "Gold needs more redemptions than Silver", path: ["goldThreshold"] });
	}
	if (value.diamondThreshold <= value.goldThreshold) {
		ctx.addIssue({ code: "custom", message: "Diamond needs more redemptions than Gold", path: ["diamondThreshold"] });
	}
}

/** The rules a fresh platform starts with (ADR 085): 10 / 25 / 50 in 12 months, at most 20 per merchant, 90-day hold, 14 days' warning. */
export const DEFAULT_TIER_RULES: TierRules = {
	silverThreshold: 10,
	goldThreshold: 25,
	diamondThreshold: 50,
	windowDays: 365,
	perMerchantCap: 20,
	holdDays: 90,
	warningDays: 14,
};

/** The counted redemptions that reach `tier` under `rules` (Bronze needs none). */
export function tierThreshold(rules: TierThresholds, tier: CustomerTier): number {
	switch (tier) {
		case "BRONZE":
			return 0;
		case "SILVER":
			return rules.silverThreshold;
		case "GOLD":
			return rules.goldThreshold;
		case "DIAMOND":
			return rules.diamondThreshold;
	}
}

/** The highest tier `countedRedemptions` reaches under `rules`. */
export function tierForCount(rules: TierThresholds, countedRedemptions: number): CustomerTier {
	const highestFirst = [...CustomerTierSchema.options].reverse();
	return highestFirst.find((tier: CustomerTier): boolean => countedRedemptions >= tierThreshold(rules, tier)) ?? ENTRY_CUSTOMER_TIER;
}

/** `GET /admin/tiers/settings`: the rules in force, and who last changed them and why (null before the first change). */
export const TierSettingsResponseSchema = z.object({
	...tierRulesShape,
	reason: z.string().nullable(),
	updatedAt: EpochMsSchema.nullable(),
	updatedByName: z.string().nullable(),
});
export type TierSettingsResponse = z.output<typeof TierSettingsResponseSchema>;

/** `PUT /admin/tiers/settings`: the new rules, with why (the audit trail keeps both). Applied by the next nightly review. */
export const UpdateTierSettingsSchema = z
	.object({ ...tierRulesShape, reason: z.string().trim().min(REASON_MIN_LENGTH).max(REASON_MAX_LENGTH) })
	.strict()
	.superRefine(refineIncreasingThresholds);
export type UpdateTierSettingsInput = z.output<typeof UpdateTierSettingsSchema>;

/**
 * `GET /tiers/availability`: whether tiers are on (the `customer-tiers` flag) and, while they are, the caller's tier —
 * Bronze for a signed-out visitor. Off, every screen hides them. The web feed uses the tier to mark locked rewards.
 */
export const TierAvailabilitySchema = z.discriminatedUnion("enabled", [
	z.object({ enabled: z.literal(false) }),
	z.object({ enabled: z.literal(true), viewerTier: CustomerTierSchema }),
]);
export type TierAvailability = z.output<typeof TierAvailabilitySchema>;

// ── A customer's own tier (`GET /tiers/me`) ──

/** One tier change, as the customer and platform staff see it. */
export const CustomerTierChangeSchema = z.object({
	id: z.uuid(),
	fromTier: CustomerTierSchema,
	toTier: CustomerTierSchema,
	reason: CustomerTierChangeReasonSchema,
	countedRedemptions: z.number().int().nonnegative(),
	occurredAt: EpochMsSchema,
});
export type CustomerTierChange = z.output<typeof CustomerTierChangeSchema>;

/** A demotion the customer has been warned about: the tier they will fall to, and when, unless they redeem more. */
export const TierDemotionWarningSchema = z.object({
	toTier: CustomerTierSchema,
	dueAt: EpochMsSchema,
	/** Counted redemptions still needed to keep the current tier. */
	redemptionsToKeep: z.number().int().nonnegative(),
});
export type TierDemotionWarning = z.output<typeof TierDemotionWarningSchema>;

/** How many of one merchant's redemptions count in the window, and how many more still would under the cap. */
export const TierMerchantCountSchema = z.object({
	tenantId: z.uuid(),
	tenantName: z.string(),
	counted: z.number().int().nonnegative(),
	remainingUnderCap: z.number().int().nonnegative(),
});
export type TierMerchantCount = z.output<typeof TierMerchantCountSchema>;

/** Counted redemptions that leave the tier window on one day. */
export const TierDropOffSchema = z.object({ on: EpochMsSchema, count: z.number().int().positive() });
export type TierDropOff = z.output<typeof TierDropOffSchema>;

/** The customer's tier page: where they stand, what is next, what is about to change, and how they got here. */
export const MyTierSchema = z.object({
	tier: CustomerTierSchema,
	countedRedemptions: z.number().int().nonnegative(),
	nextTier: CustomerTierSchema.nullable(),
	/** Counted redemptions still needed for the next tier; null at Diamond. */
	redemptionsToNextTier: z.number().int().nonnegative().nullable(),
	/** End of the tier hold; null when there is none or it has passed. */
	holdUntil: EpochMsSchema.nullable(),
	demotionWarning: TierDemotionWarningSchema.nullable(),
	merchants: z.array(TierMerchantCountSchema),
	/** The next days on which counted redemptions leave the window, soonest first. */
	upcomingDropOffs: z.array(TierDropOffSchema),
	history: z.array(CustomerTierChangeSchema),
	/** The rules in force, as a response reads them: open, so a field added later never breaks an older client (ADR 022). */
	rules: z.object(tierRulesShape),
});
export type MyTier = z.output<typeof MyTierSchema>;

// ── Platform staff ──

export const AdminUserTierPathSchema = z.object({ userId: z.uuid() }).strict();
export type AdminUserTierPath = z.output<typeof AdminUserTierPathSchema>;

/** A customer's tier as platform staff see it on the user's page (read-only: there is no override, ADR 085). */
export const AdminUserTierSchema = z.object({
	tier: CustomerTierSchema,
	countedRedemptions: z.number().int().nonnegative(),
	holdUntil: EpochMsSchema.nullable(),
	demotionWarning: TierDemotionWarningSchema.nullable(),
	evaluatedAt: EpochMsSchema.nullable(),
	history: z.array(CustomerTierChangeSchema),
});
export type AdminUserTier = z.output<typeof AdminUserTierSchema>;

/** How many customers stand at each tier (a customer with no standing yet is Bronze). */
export const TierDistributionSchema = z.object({
	counts: z.record(CustomerTierSchema, z.number().int().nonnegative()),
	total: z.number().int().nonnegative(),
});
export type TierDistribution = z.output<typeof TierDistributionSchema>;
