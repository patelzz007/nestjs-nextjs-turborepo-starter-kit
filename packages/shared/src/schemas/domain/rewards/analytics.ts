import { z } from "zod";

import { EpochMsSchema } from "../../api/common";
import { OrganizationLocationFilterSchema } from "../organization/location-filter";
import { AnalyticsQuerySchema } from "../platform/clicks";
import { RewardClaimStatusSchema } from "./rewards";
import { SaleCurrencySchema } from "./rewards-entities";
import { MerchantBusinessCategorySchema, PLATFORM_DISPLAY_REGION, type DisplayRegion } from "./rewards-enums";
import { IanaTimeZoneSchema, startOfWeekInTimeZone, UTC_TIME_ZONE } from "./analytics-time-zone";

/** Milliseconds in one day. */
export const DAY_MS = 86_400_000;

/** Days in one analytics week (weekly buckets start on Monday 00:00 in the bucket time zone). */
const DAYS_PER_WEEK = 7;

/** Milliseconds in one week. */
export const WEEK_MS = DAYS_PER_WEEK * DAY_MS;

/** Weeks an analytics request covers when it sends no `from` (the current week plus the seven before it). */
export const DEFAULT_ANALYTICS_WEEKS = 8;

/** Longest period one analytics request may cover — keeps every aggregate bounded. */
export const MAX_ANALYTICS_WEEKS = 53;

/** Monday 00:00:00.000 UTC of the week containing `epochMs` (the platform-wide bucket start). */
export function startOfUtcWeekMs(epochMs: number): number {
	return startOfWeekInTimeZone(epochMs, UTC_TIME_ZONE);
}

/** An analytics period in epoch ms; `fromMs` is always a week start in `timeZone`. */
export interface AnalyticsPeriodRange {
	readonly fromMs: number;
	readonly toMs: number;
	/** IANA zone the weekly buckets are cut in: the merchant's own zone, or UTC for platform / customer views. */
	readonly timeZone: string;
}

/**
 * The period an analytics request actually covers. `to` defaults to `nowMs`;
 * `from` defaults to {@link DEFAULT_ANALYTICS_WEEKS} weeks back. `from` is then
 * aligned DOWN to its UTC week start, so every weekly bucket — including the
 * first — is a whole week (the last one ends at `to`). The API echoes this
 * aligned period in the response; clients pick a week count with
 * {@link analyticsQueryForWeeks}.
 */
export function resolveAnalyticsPeriodRange(from: number | undefined, to: number | undefined, nowMs: number, timeZone: string = UTC_TIME_ZONE): AnalyticsPeriodRange {
	const toMs = to ?? nowMs;
	const requestedFromMs = from ?? startOfWeekInTimeZone(toMs, timeZone) - (DEFAULT_ANALYTICS_WEEKS - 1) * WEEK_MS;
	return { fromMs: startOfWeekInTimeZone(requestedFromMs, timeZone), toMs, timeZone };
}

/** The query for "the last `weeks` weeks" ending now, already aligned to UTC week boundaries (the current week counts as one). */
export function analyticsQueryForWeeks(weeks: number, nowMs: number): { readonly from: number; readonly to: number } {
	return { from: startOfUtcWeekMs(nowMs) - (weeks - 1) * WEEK_MS, to: nowMs };
}

/** `from` must precede `to`, and the span is capped at {@link MAX_ANALYTICS_WEEKS} weeks. */
function validateAnalyticsPeriod(value: { readonly from?: number | undefined; readonly to?: number | undefined }, context: z.RefinementCtx): void {
	if (value.from !== undefined && value.to !== undefined && value.from >= value.to) {
		context.addIssue({ code: "custom", message: "from must be earlier than to", path: ["from"] });
		return;
	}
	if (value.from !== undefined) {
		const toMs = value.to ?? Date.now();
		if (toMs - startOfUtcWeekMs(value.from) > MAX_ANALYTICS_WEEKS * WEEK_MS) {
			context.addIssue({ code: "custom", message: `The period may cover at most ${String(MAX_ANALYTICS_WEEKS)} weeks`, path: ["from"] });
		}
	}
}

/**
 * The period an analytics response covers. `from` is a week start in
 * `timeZone`, the zone every weekly point (`date`) was bucketed in: the
 * merchant's own zone (`Organization.timeZone`) for merchant analytics, UTC
 * for the admin platform view and the customer's cross-merchant view. Label a
 * point in `timeZone` so "Mon 6 Oct" is the bucket's own Monday.
 */
export const AnalyticsPeriodSchema = z.object({ from: EpochMsSchema, to: EpochMsSchema, timeZone: IanaTimeZoneSchema });

export type AnalyticsPeriod = z.output<typeof AnalyticsPeriodSchema>;

/**
 * Region a UTC-bucketed analytics series (admin platform view, customer view)
 * is labelled in: a point is named by its UTC calendar day — in a zone west of
 * UTC the same instant would read as the previous day. Merchant series are
 * bucketed in the merchant's zone: label them with {@link analyticsBucketRegion}.
 */
export const ANALYTICS_BUCKET_DISPLAY_REGION: DisplayRegion = {
	locale: PLATFORM_DISPLAY_REGION.locale,
	timeZone: UTC_TIME_ZONE,
};

/** The region to label a response's weekly points in: the platform locale, the response's bucket zone. */
export function analyticsBucketRegion(period: AnalyticsPeriod): DisplayRegion {
	return { locale: PLATFORM_DISPLAY_REGION.locale, timeZone: period.timeZone };
}

export const RewardsAnalyticsQuerySchema = AnalyticsQuerySchema.extend(OrganizationLocationFilterSchema.shape).strict().superRefine(validateAnalyticsPeriod);

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
	/**
	 * When the first bill in this scope was paid (all time, not just the period); `null` until the
	 * POS has reported a bill. Distinguishes "no sales yet — integrate checkout" from "no sales this period".
	 */
	firstBillAt: EpochMsSchema.nullable(),
});

export type SalesSummary = z.output<typeof SalesSummarySchema>;

export const MerchantAnalyticsResponseSchema = z.object({
	period: AnalyticsPeriodSchema,
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
	period: AnalyticsPeriodSchema,
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
export const AdminSalesAnalyticsQuerySchema = AnalyticsQuerySchema.superRefine(validateAnalyticsPeriod);

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
	period: AnalyticsPeriodSchema,
	sales: SalesSummarySchema,
	/** Merchants with at least one paid bill in the period. */
	activeMerchants: AnalyticsMetricSchema,
	topMerchants: z.array(AdminSalesTopMerchantSchema),
});

export type AdminSalesAnalyticsResponse = z.output<typeof AdminSalesAnalyticsResponseSchema>;
