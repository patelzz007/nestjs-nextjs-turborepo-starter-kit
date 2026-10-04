import { z } from "zod";

// ── Enums (mirror Prisma — packages/shared cannot import @prisma/client) ───

export const PilotCitySchema = z.enum(["KUALA_LUMPUR", "MELAKA"]);
export type PilotCity = z.output<typeof PilotCitySchema>;

/** Display name of every pilot city — one copy for every app's filters, lists and copy. */
export const PILOT_CITY_LABELS: Readonly<Record<PilotCity, string>> = {
	KUALA_LUMPUR: "Kuala Lumpur",
	MELAKA: "Melaka",
};

/** IANA time zone of every pilot city — where its stores open, close and redeem. */
export const PILOT_CITY_TIME_ZONES: Readonly<Record<PilotCity, string>> = {
	KUALA_LUMPUR: "Asia/Kuala_Lumpur",
	MELAKA: "Asia/Kuala_Lumpur",
};

/** The locale and IANA time zone a date, time, count or money amount is rendered in. */
export interface DisplayRegion {
	/** BCP 47 locale tag, e.g. `en-MY`. */
	readonly locale: string;
	/** IANA time zone, e.g. `Asia/Kuala_Lumpur`. */
	readonly timeZone: string;
}

/**
 * The region every web, merchant and admin screen renders in: Malaysian English,
 * Malaysia time. Every pilot city is in this one zone (a test pins that
 * {@link PILOT_CITY_TIME_ZONES} agree with it), so a time shown in it is the
 * stores' own wall-clock time — what a customer redeeming in-store and a
 * merchant reading their redemptions both expect.
 *
 * Rendering in one fixed region instead of the runtime's default is what keeps
 * server-rendered HTML identical to the first client render: a Node server
 * (often UTC, `en-US`) and a browser (the viewer's own zone) would otherwise
 * format the same instant differently and React reports a hydration mismatch.
 */
export const PLATFORM_DISPLAY_REGION: DisplayRegion = {
	locale: "en-MY",
	timeZone: "Asia/Kuala_Lumpur",
};

export const MerchantOrgStatusSchema = z.enum(["ONBOARDING", "ACTIVE", "SUSPENDED"]);
export type MerchantOrgStatus = z.output<typeof MerchantOrgStatusSchema>;

export const KybStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "ACTION_REQUIRED"]);
export type KybStatus = z.output<typeof KybStatusSchema>;

/**
 * What a KYB document's malware scan means for the review — the API contract
 * shown to merchants and admins (not the database scan column):
 * - `SCANNING`    — verdict pending; the document cannot be opened yet.
 * - `CLEAN`       — scanned clean; downloadable.
 * - `NOT_SCANNED` — no malware scanner is configured; the document passed the
 *                   size / checksum / file-type checks only. Downloadable, but
 *                   reviewers must not treat it as malware-checked.
 * - `INFECTED`    — the scanner flagged it; the bytes were removed. Re-upload needed.
 * - `SCAN_FAILED` — no verdict could be obtained (the object was missing, or the
 *                   scanner stayed unavailable through every retry). Nothing was
 *                   found in it, but it was never cleared either. Re-upload needed.
 */
export const KybDocumentScanStatusSchema = z.enum(["SCANNING", "CLEAN", "NOT_SCANNED", "INFECTED", "SCAN_FAILED"]);
export type KybDocumentScanStatus = z.output<typeof KybDocumentScanStatusSchema>;

export const MerchantMemberRoleSchema = z.enum(["OWNER", "CASHIER"]);
export type MerchantMemberRole = z.output<typeof MerchantMemberRoleSchema>;

export const RewardTypeSchema = z.enum(["DISCOUNT", "FREE_ITEM", "CASHBACK", "POINTS", "BOGO"]);
export type RewardType = z.output<typeof RewardTypeSchema>;

export const RewardStatusSchema = z.enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED", "EXPIRED", "DISABLED"]);
export type RewardStatus = z.output<typeof RewardStatusSchema>;

export const RewardKindSchema = z.enum(["CONSUMER", "REFERRER"]);
export type RewardKind = z.output<typeof RewardKindSchema>;

export const RewardClaimStatusSchema = z.enum(["PENDING", "REDEEMED", "EXPIRED"]);
export type RewardClaimStatus = z.output<typeof RewardClaimStatusSchema>;

export const RewardRedemptionMethodSchema = z.enum(["SCAN", "MANUAL"]);
export type RewardRedemptionMethod = z.output<typeof RewardRedemptionMethodSchema>;

export const RewardReferralStatusSchema = z.enum(["PENDING", "CREDITED", "BLOCKED"]);
export type RewardReferralStatus = z.output<typeof RewardReferralStatusSchema>;

export const RewardOtpPurposeSchema = z.enum(["CLAIM"]);
export type RewardOtpPurpose = z.output<typeof RewardOtpPurposeSchema>;

/** Stock placeholder image keys by category (Phase 1). */
export const RewardCategorySchema = z.enum(["cafe", "restaurant", "retail", "wellness", "entertainment", "food", "beverage"]);
export type RewardCategory = z.output<typeof RewardCategorySchema>;

/** Merchant business type — same vocabulary as reward categories. */
export const MerchantBusinessCategorySchema = RewardCategorySchema;
export type MerchantBusinessCategory = z.output<typeof MerchantBusinessCategorySchema>;

export const MERCHANT_BUSINESS_CATEGORY_LABELS: Record<MerchantBusinessCategory, string> = {
	cafe: "Café",
	restaurant: "Restaurant",
	retail: "Retail",
	wellness: "Wellness",
	entertainment: "Entertainment",
	food: "Food",
	beverage: "Beverage",
};

/** Label for a merchant without a (recognised) business category — used by every sales / spending breakdown. */
export const UNCATEGORISED_MERCHANT_CATEGORY_LABEL = "Other";

const rewardRulesShape = {
	minSpendMyr: z.number().nonnegative().optional(),
	maxUsePerUser: z.number().int().positive().optional(),
};

/** Reward rules as a merchant SENDS them (request input) — closed: unknown keys are rejected. */
export const RewardRulesSchema = z.object(rewardRulesShape).strict();

export type RewardRules = z.output<typeof RewardRulesSchema>;

/** Reward rules as the API RETURNS them (inside `RewardResponseSchema`) — open, so additive fields never break a client (ADR 022). */
export const RewardRulesResponseSchema = z.object(rewardRulesShape);

/** 8-char backup code: A–Z + 2–9, excludes 0/O/1/I. */
export const RewardBackupCodeSchema = z
	.string()
	.length(8)
	.regex(/^[A-HJ-NP-Z2-9]{8}$/, "Invalid backup code format");

export type RewardBackupCode = z.output<typeof RewardBackupCodeSchema>;

export const RewardTerminalIdHeaderSchema = z.string().min(1).max(100);
