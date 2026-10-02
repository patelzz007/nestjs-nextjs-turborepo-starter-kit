import { z } from "zod";

import { EpochMsSchema } from "../../api/common";
import { OrganizationLocationFilterSchema } from "../organization/location-filter";
import { AnalyticsQuerySchema } from "../platform/clicks";
import { RewardClaimStatusSchema } from "./rewards";
import { SaleCurrencySchema } from "./rewards-entities";
import { MerchantBusinessCategorySchema } from "./rewards-enums";

export const RewardsAnalyticsQuerySchema = AnalyticsQuerySchema.extend(OrganizationLocationFilterSchema.shape).strict();

export type RewardsAnalyticsQuery = z.output<typeof RewardsAnalyticsQuerySchema>;

export const AnalyticsMetricSchema = z.object({
	value: z.number(),
	changePercent: z.number().nullable(),
});

export type AnalyticsMetric = z.output<typeof AnalyticsMetricSchema>;

export const MerchantAnalyticsTimePointSchema = z.object({
	date: EpochMsSchema,
	claims: z.number().int().nonnegative(),
	redemptions: z.number().int().nonnegative(),
});

export type MerchantAnalyticsTimePoint = z.output<typeof MerchantAnalyticsTimePointSchema>;

export const MerchantAnalyticsTopRewardSchema = z.object({
	rewardId: z.uuid(),
	title: z.string(),
	claims: z.number().int().nonnegative(),
	redemptions: z.number().int().nonnegative(),
});

export type MerchantAnalyticsTopReward = z.output<typeof MerchantAnalyticsTopRewardSchema>;

/** One week of paid POS bills (checkouts). */
export const SalesTimePointSchema = z.object({
	date: EpochMsSchema,
	salesMinor: z.number().int().nonnegative(),
	bills: z.number().int().nonnegative(),
});

export type SalesTimePoint = z.output<typeof SalesTimePointSchema>;

/** Paid-bill totals for a period (vs the previous period of equal length); money in minor units of `currency`. */
export const SalesSummarySchema = z.object({
	currency: SaleCurrencySchema,
	totalSalesMinor: AnalyticsMetricSchema,
	bills: AnalyticsMetricSchema,
	averageBillMinor: AnalyticsMetricSchema,
	overTime: z.array(SalesTimePointSchema),
});

export type SalesSummary = z.output<typeof SalesSummarySchema>;

export const MerchantAnalyticsResponseSchema = z.object({
	period: z.object({ from: EpochMsSchema, to: EpochMsSchema }),
	totalRewards: AnalyticsMetricSchema,
	activeRewards: AnalyticsMetricSchema,
	totalClaims: AnalyticsMetricSchema,
	totalRedemptions: AnalyticsMetricSchema,
	conversionRate: AnalyticsMetricSchema,
	referralCount: AnalyticsMetricSchema,
	claimsOverTime: z.array(MerchantAnalyticsTimePointSchema),
	topRewards: z.array(MerchantAnalyticsTopRewardSchema),
	sales: SalesSummarySchema,
});

export type MerchantAnalyticsResponse = z.output<typeof MerchantAnalyticsResponseSchema>;

export const UserAnalyticsStatusBreakdownSchema = z.object({
	status: RewardClaimStatusSchema,
	count: z.number().int().nonnegative(),
});

export type UserAnalyticsStatusBreakdown = z.output<typeof UserAnalyticsStatusBreakdownSchema>;

/** Where the user spent: one merchant's paid bills in the period. */
export const UserSpendByMerchantSchema = z.object({
	organizationId: z.uuid(),
	merchantName: z.string(),
	category: MerchantBusinessCategorySchema.nullable(),
	totalMinor: z.number().int().nonnegative(),
	visits: z.number().int().nonnegative(),
});

export type UserSpendByMerchant = z.output<typeof UserSpendByMerchantSchema>;

/** What the user spent on: paid bills grouped by the merchant's business category (`null` = uncategorised). */
export const UserSpendByCategorySchema = z.object({
	category: MerchantBusinessCategorySchema.nullable(),
	totalMinor: z.number().int().nonnegative(),
	visits: z.number().int().nonnegative(),
});

export type UserSpendByCategory = z.output<typeof UserSpendByCategorySchema>;

export const UserSpendingSummarySchema = z.object({
	currency: SaleCurrencySchema,
	totalSpentMinor: AnalyticsMetricSchema,
	visits: AnalyticsMetricSchema,
	/** Highest spend first. */
	byMerchant: z.array(UserSpendByMerchantSchema),
	/** Highest spend first. */
	byCategory: z.array(UserSpendByCategorySchema),
});

export type UserSpendingSummary = z.output<typeof UserSpendingSummarySchema>;

export const UserRewardsAnalyticsResponseSchema = z.object({
	period: z.object({ from: EpochMsSchema, to: EpochMsSchema }),
	totalClaims: AnalyticsMetricSchema,
	pendingClaims: AnalyticsMetricSchema,
	redeemedClaims: AnalyticsMetricSchema,
	expiredClaims: AnalyticsMetricSchema,
	referralsSent: AnalyticsMetricSchema,
	referralsCredited: AnalyticsMetricSchema,
	conversionRate: AnalyticsMetricSchema,
	claimsOverTime: z.array(MerchantAnalyticsTimePointSchema),
	byStatus: z.array(UserAnalyticsStatusBreakdownSchema),
	spending: UserSpendingSummarySchema,
});

export type UserRewardsAnalyticsResponse = z.output<typeof UserRewardsAnalyticsResponseSchema>;

/** `GET /admin/analytics/sales` — platform-wide paid bills. */
export const AdminSalesAnalyticsQuerySchema = AnalyticsQuerySchema;

export type AdminSalesAnalyticsQuery = z.output<typeof AdminSalesAnalyticsQuerySchema>;

export const AdminSalesTopMerchantSchema = z.object({
	organizationId: z.uuid(),
	name: z.string(),
	category: MerchantBusinessCategorySchema.nullable(),
	salesMinor: z.number().int().nonnegative(),
	bills: z.number().int().nonnegative(),
});

export type AdminSalesTopMerchant = z.output<typeof AdminSalesTopMerchantSchema>;

export const AdminSalesAnalyticsResponseSchema = z.object({
	period: z.object({ from: EpochMsSchema, to: EpochMsSchema }),
	sales: SalesSummarySchema,
	/** Merchants with at least one paid bill in the period. */
	activeMerchants: AnalyticsMetricSchema,
	topMerchants: z.array(AdminSalesTopMerchantSchema),
});

export type AdminSalesAnalyticsResponse = z.output<typeof AdminSalesAnalyticsResponseSchema>;
