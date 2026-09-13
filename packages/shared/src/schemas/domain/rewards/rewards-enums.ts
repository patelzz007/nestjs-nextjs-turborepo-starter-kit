import { z } from "zod";

import { StoredObjectScanStatusSchema, type StoredObjectScanStatus } from "../platform/storage";

// ── Enums (mirror Prisma — packages/shared cannot import @prisma/client) ───

export const PilotCitySchema = z.enum(["KUALA_LUMPUR", "MELAKA"]);
export type PilotCity = z.output<typeof PilotCitySchema>;

export const MerchantOrgStatusSchema = z.enum(["ONBOARDING", "ACTIVE", "SUSPENDED"]);
export type MerchantOrgStatus = z.output<typeof MerchantOrgStatusSchema>;

export const KybStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "ACTION_REQUIRED"]);
export type KybStatus = z.output<typeof KybStatusSchema>;

export const KybDocumentScanStatusSchema = StoredObjectScanStatusSchema;
export type KybDocumentScanStatus = StoredObjectScanStatus;

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

export const RewardRulesSchema = z
	.object({
		minSpendMyr: z.number().nonnegative().optional(),
		maxUsePerUser: z.number().int().positive().optional(),
	})
	.strict();

export type RewardRules = z.output<typeof RewardRulesSchema>;

/** 8-char backup code: A–Z + 2–9, excludes 0/O/1/I. */
export const RewardBackupCodeSchema = z
	.string()
	.length(8)
	.regex(/^[A-HJ-NP-Z2-9]{8}$/, "Invalid backup code format");

export type RewardBackupCode = z.output<typeof RewardBackupCodeSchema>;

export const RewardTerminalIdHeaderSchema = z.string().min(1).max(100);
