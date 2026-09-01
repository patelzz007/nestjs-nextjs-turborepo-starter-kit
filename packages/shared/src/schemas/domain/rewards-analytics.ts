import { z } from "zod";

import { EpochMsSchema } from "../api/common";
import { AnalyticsQuerySchema } from "./clicks";
import { RewardClaimStatusSchema } from "./rewards";

export const RewardsAnalyticsQuerySchema = AnalyticsQuerySchema.strict();

export type RewardsAnalyticsQuery = z.output<typeof RewardsAnalyticsQuerySchema>;

export const AnalyticsMetricSchema = z
	.object({
		value: z.number(),
		changePercent: z.number().nullable(),
	})
	.strict();

export type AnalyticsMetric = z.output<typeof AnalyticsMetricSchema>;

export const MerchantAnalyticsTimePointSchema = z
	.object({
		date: EpochMsSchema,
		claims: z.number().int().nonnegative(),
		redemptions: z.number().int().nonnegative(),
	})
	.strict();

export type MerchantAnalyticsTimePoint = z.output<typeof MerchantAnalyticsTimePointSchema>;

export const MerchantAnalyticsTopRewardSchema = z
	.object({
		rewardId: z.uuid(),
		title: z.string(),
		claims: z.number().int().nonnegative(),
		redemptions: z.number().int().nonnegative(),
	})
	.strict();

export type MerchantAnalyticsTopReward = z.output<typeof MerchantAnalyticsTopRewardSchema>;

export const MerchantAnalyticsResponseSchema = z
	.object({
		period: z.object({ from: EpochMsSchema, to: EpochMsSchema }),
		totalRewards: AnalyticsMetricSchema,
		activeRewards: AnalyticsMetricSchema,
		totalClaims: AnalyticsMetricSchema,
		totalRedemptions: AnalyticsMetricSchema,
		conversionRate: AnalyticsMetricSchema,
		referralCount: AnalyticsMetricSchema,
		claimsOverTime: z.array(MerchantAnalyticsTimePointSchema),
		topRewards: z.array(MerchantAnalyticsTopRewardSchema),
	})
	.strict();

export type MerchantAnalyticsResponse = z.output<typeof MerchantAnalyticsResponseSchema>;

export const UserAnalyticsStatusBreakdownSchema = z
	.object({
		status: RewardClaimStatusSchema,
		count: z.number().int().nonnegative(),
	})
	.strict();

export type UserAnalyticsStatusBreakdown = z.output<typeof UserAnalyticsStatusBreakdownSchema>;

export const UserRewardsAnalyticsResponseSchema = z
	.object({
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
	})
	.strict();

export type UserRewardsAnalyticsResponse = z.output<typeof UserRewardsAnalyticsResponseSchema>;
