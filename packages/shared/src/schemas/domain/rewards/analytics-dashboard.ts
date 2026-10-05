// ============================================
// analytics-dashboard.ts — the analytics dashboards of the customer, the merchant and the admin
// ============================================
// `GET /claims/analytics/dashboard`, `GET /orgs/:orgSlug/analytics/dashboard`,
// `GET /admin/analytics/dashboard` (docs/technical/api/analytics.md). Every
// number is computed in Postgres for the request's range ([from, to), see
// analytics-range.ts); every series has one point per bucket of the range,
// empty buckets as zero. Money is in integer minor units of `currency` (sen).
//
// These supersede the weekly v1 summaries (`…/analytics`, `/admin/analytics/sales`),
// which stay unchanged for API clients; every analytics screen reads the dashboards.

import { z } from "zod";

import { EpochMsSchema } from "../../api/common";
import { OrganizationLocationFilterSchema } from "../organization/location-filter";
import { analyticsRangeQueryShape, AnalyticsReportRangeSchema, validateAnalyticsRange } from "./analytics-range";
import { SaleCurrencySchema } from "./rewards-entities";
import { MerchantBusinessCategorySchema, PilotCitySchema, RewardClaimStatusSchema, RewardRedemptionMethodSchema } from "./rewards-enums";

// ── Queries ────────────────────────────────────────────────────────────────

/** `GET /claims/analytics/dashboard` — the signed-in customer's own activity. */
export const CustomerAnalyticsDashboardQuerySchema = z.object(analyticsRangeQueryShape).strict().superRefine(validateAnalyticsRange);

export type CustomerAnalyticsDashboardQuery = z.output<typeof CustomerAnalyticsDashboardQuerySchema>;

/**
 * `GET /orgs/:orgSlug/analytics/dashboard`. `locationId` narrows to one store;
 * without it a store-limited member still sees only their own stores.
 */
export const MerchantAnalyticsDashboardQuerySchema = z
	.object({ ...analyticsRangeQueryShape, ...OrganizationLocationFilterSchema.shape })
	.strict()
	.superRefine(validateAnalyticsRange);

export type MerchantAnalyticsDashboardQuery = z.output<typeof MerchantAnalyticsDashboardQuerySchema>;

/** `GET /admin/analytics/dashboard` — the whole platform. */
export const AdminAnalyticsDashboardQuerySchema = z.object(analyticsRangeQueryShape).strict().superRefine(validateAnalyticsRange);

export type AdminAnalyticsDashboardQuery = z.output<typeof AdminAnalyticsDashboardQuerySchema>;

// ── Building blocks ────────────────────────────────────────────────────────

const CountSchema = z.number().int().nonnegative();
const MinorUnitsSchema = z.number().int().nonnegative();
/** A percentage with one decimal place (12.5 = 12.5 %). */
const PercentSchema = z.number().nonnegative();

/**
 * One KPI for the range, compared with the previous range of equal length.
 * `change` = value − previous; `changePercent` = change / previous × 100 with
 * one decimal place, `null` when `previous` is 0 (no meaningful base).
 */
export const AnalyticsComparisonSchema = z.object({
	value: z.number(),
	previous: z.number(),
	change: z.number(),
	changePercent: z.number().nullable(),
});

export type AnalyticsComparison = z.output<typeof AnalyticsComparisonSchema>;

/**
 * One bucket of a time series: `[start, end)`, clipped to the range. Label it
 * by `start` in the response's `range.timeZone`. `isPartial` = the bucket was
 * clipped (the range starts or ends inside it), so its total covers fewer days.
 */
export const AnalyticsBucketSchema = z.object({
	start: EpochMsSchema,
	end: EpochMsSchema,
	isPartial: z.boolean(),
});

export type AnalyticsBucket = z.output<typeof AnalyticsBucketSchema>;

/** One value per bucket of the response's series (same `start`s, same order). */
export const AnalyticsSeriesValueSchema = z.object({ start: EpochMsSchema, totalMinor: MinorUnitsSchema });

export type AnalyticsSeriesValue = z.output<typeof AnalyticsSeriesValueSchema>;

// ── Merchant ───────────────────────────────────────────────────────────────

export const MerchantDashboardTotalsSchema = z.object({
	/** Paid bills (POS checkouts) in minor units. */
	salesMinor: AnalyticsComparisonSchema,
	bills: AnalyticsComparisonSchema,
	averageBillMinor: AnalyticsComparisonSchema,
	/** Claims of the organization's rewards available at the caller's stores. */
	claims: AnalyticsComparisonSchema,
	redemptions: AnalyticsComparisonSchema,
	/** Redemptions ÷ claims of the range, in percent (one decimal). */
	conversionRate: AnalyticsComparisonSchema,
	/** Distinct customers with at least one paid bill. */
	customers: AnalyticsComparisonSchema,
});

export type MerchantDashboardTotals = z.output<typeof MerchantDashboardTotalsSchema>;

export const MerchantDashboardPointSchema = AnalyticsBucketSchema.extend({
	salesMinor: MinorUnitsSchema,
	bills: CountSchema,
	averageBillMinor: MinorUnitsSchema,
	claims: CountSchema,
	redemptions: CountSchema,
});

export type MerchantDashboardPoint = z.output<typeof MerchantDashboardPointSchema>;

/** One store of the caller's scope. `locationId: null` = bills paid without a known store (all-stores callers only). */
export const MerchantStoreBreakdownSchema = z.object({
	locationId: z.uuid().nullable(),
	name: z.string().nullable(),
	city: PilotCitySchema.nullable(),
	salesMinor: MinorUnitsSchema,
	bills: CountSchema,
	averageBillMinor: MinorUnitsSchema,
	redemptions: CountSchema,
});

export type MerchantStoreBreakdown = z.output<typeof MerchantStoreBreakdownSchema>;

/** One reward: its claims and redemptions in the range (most active first, bounded). */
export const MerchantRewardBreakdownSchema = z.object({
	rewardId: z.uuid(),
	title: z.string(),
	claims: CountSchema,
	redemptions: CountSchema,
	conversionRate: PercentSchema,
});

export type MerchantRewardBreakdown = z.output<typeof MerchantRewardBreakdownSchema>;

/** Redemptions per method (`SCAN` = QR at the till, `MANUAL` = backup code). Every method is listed, zero included. */
export const RedemptionMethodBreakdownSchema = z.object({
	method: RewardRedemptionMethodSchema,
	redemptions: CountSchema,
});

export type RedemptionMethodBreakdown = z.output<typeof RedemptionMethodBreakdownSchema>;

export const MerchantAnalyticsDashboardSchema = z.object({
	range: AnalyticsReportRangeSchema,
	currency: SaleCurrencySchema,
	/** First paid bill in the caller's scope, all time; `null` before the POS reported any — tells "integrate checkout" from "no sales this range". */
	firstBillAt: EpochMsSchema.nullable(),
	totals: MerchantDashboardTotalsSchema,
	series: z.array(MerchantDashboardPointSchema),
	/** Highest sales first. */
	byStore: z.array(MerchantStoreBreakdownSchema),
	/** Most claims + redemptions first, at most `MERCHANT_REWARD_BREAKDOWN_LIMIT`. */
	byReward: z.array(MerchantRewardBreakdownSchema),
	byRedemptionMethod: z.array(RedemptionMethodBreakdownSchema),
});

export type MerchantAnalyticsDashboard = z.output<typeof MerchantAnalyticsDashboardSchema>;

/** Rewards listed in the merchant's reward breakdown (dashboard and export). */
export const MERCHANT_REWARD_BREAKDOWN_LIMIT = 25;

// ── Admin ──────────────────────────────────────────────────────────────────

export const AdminDashboardTotalsSchema = z.object({
	salesMinor: AnalyticsComparisonSchema,
	bills: AnalyticsComparisonSchema,
	averageBillMinor: AnalyticsComparisonSchema,
	claims: AnalyticsComparisonSchema,
	redemptions: AnalyticsComparisonSchema,
	conversionRate: AnalyticsComparisonSchema,
	/** Merchants with at least one paid bill. */
	activeMerchants: AnalyticsComparisonSchema,
	/** Distinct customers with at least one paid bill. */
	customers: AnalyticsComparisonSchema,
	/** Customers whose FIRST bill ever (platform-wide) falls in the range. */
	newCustomers: AnalyticsComparisonSchema,
	/** Customers with a bill in the range whose first bill ever was before it. */
	returningCustomers: AnalyticsComparisonSchema,
});

export type AdminDashboardTotals = z.output<typeof AdminDashboardTotalsSchema>;

export const AdminDashboardPointSchema = AnalyticsBucketSchema.extend({
	salesMinor: MinorUnitsSchema,
	bills: CountSchema,
	averageBillMinor: MinorUnitsSchema,
	claims: CountSchema,
	redemptions: CountSchema,
	/** Customers whose first bill ever falls in this bucket. */
	newCustomers: CountSchema,
	/** Customers with a bill in this bucket whose first bill ever was before it. */
	returningCustomers: CountSchema,
});

export type AdminDashboardPoint = z.output<typeof AdminDashboardPointSchema>;

export const AdminTopMerchantSchema = z.object({
	organizationId: z.uuid(),
	name: z.string(),
	category: MerchantBusinessCategorySchema.nullable(),
	salesMinor: MinorUnitsSchema,
	bills: CountSchema,
	averageBillMinor: MinorUnitsSchema,
});

export type AdminTopMerchant = z.output<typeof AdminTopMerchantSchema>;

/** Sales per merchant business category; `category: null` = uncategorised (label it `UNCATEGORISED_MERCHANT_CATEGORY_LABEL`). */
export const AdminCategoryBreakdownSchema = z.object({
	category: MerchantBusinessCategorySchema.nullable(),
	salesMinor: MinorUnitsSchema,
	bills: CountSchema,
	merchants: CountSchema,
});

export type AdminCategoryBreakdown = z.output<typeof AdminCategoryBreakdownSchema>;

/** Sales per city of the store the bill was paid at; `city: null` = store unknown. */
export const AdminCityBreakdownSchema = z.object({
	city: PilotCitySchema.nullable(),
	salesMinor: MinorUnitsSchema,
	bills: CountSchema,
	merchants: CountSchema,
});

export type AdminCityBreakdown = z.output<typeof AdminCityBreakdownSchema>;

export const AdminAnalyticsDashboardSchema = z.object({
	range: AnalyticsReportRangeSchema,
	currency: SaleCurrencySchema,
	totals: AdminDashboardTotalsSchema,
	series: z.array(AdminDashboardPointSchema),
	/** Highest sales first, at most `ADMIN_TOP_MERCHANTS_LIMIT`. */
	topMerchants: z.array(AdminTopMerchantSchema),
	/** Highest sales first. */
	byCategory: z.array(AdminCategoryBreakdownSchema),
	/** Highest sales first. */
	byCity: z.array(AdminCityBreakdownSchema),
});

export type AdminAnalyticsDashboard = z.output<typeof AdminAnalyticsDashboardSchema>;

/** Merchants listed in the admin's top-merchants table (dashboard and export). */
export const ADMIN_TOP_MERCHANTS_LIMIT = 10;

// ── Customer ───────────────────────────────────────────────────────────────

export const CustomerDashboardTotalsSchema = z.object({
	/** The customer's paid bills (where they redeemed rewards), in minor units. */
	spentMinor: AnalyticsComparisonSchema,
	visits: AnalyticsComparisonSchema,
	averageBillMinor: AnalyticsComparisonSchema,
	claims: AnalyticsComparisonSchema,
	redemptions: AnalyticsComparisonSchema,
	/** Redemptions ÷ claims of the range, in percent (one decimal). */
	conversionRate: AnalyticsComparisonSchema,
	/** Distinct merchants visited. */
	merchants: AnalyticsComparisonSchema,
	/** Referral links the customer shared that were opened (referrals created in the range). */
	referralsSent: AnalyticsComparisonSchema,
	/** The customer's referrals credited in the range (the friend redeemed; `creditedAt` in the range). */
	referralsCredited: AnalyticsComparisonSchema,
	/** Referrer reward claims the customer received in the range — what the credited referrals earned them. */
	referralRewardsEarned: AnalyticsComparisonSchema,
});

export type CustomerDashboardTotals = z.output<typeof CustomerDashboardTotalsSchema>;

export const CustomerDashboardPointSchema = AnalyticsBucketSchema.extend({
	spentMinor: MinorUnitsSchema,
	visits: CountSchema,
	claims: CountSchema,
	redemptions: CountSchema,
});

export type CustomerDashboardPoint = z.output<typeof CustomerDashboardPointSchema>;

/** Spending in one merchant category, with its own series (one value per bucket of `series`). */
export const CustomerCategorySpendSchema = z.object({
	category: MerchantBusinessCategorySchema.nullable(),
	totalMinor: MinorUnitsSchema,
	visits: CountSchema,
	series: z.array(AnalyticsSeriesValueSchema),
});

export type CustomerCategorySpend = z.output<typeof CustomerCategorySpendSchema>;

/** Spending at one merchant, with its own series (one value per bucket of `series`). */
export const CustomerMerchantSpendSchema = z.object({
	organizationId: z.uuid(),
	merchantName: z.string(),
	category: MerchantBusinessCategorySchema.nullable(),
	totalMinor: MinorUnitsSchema,
	visits: CountSchema,
	series: z.array(AnalyticsSeriesValueSchema),
});

export type CustomerMerchantSpend = z.output<typeof CustomerMerchantSpendSchema>;

/** Claims made in the range (`claimedAt`) by their CURRENT status. Every status is listed, zero included. */
export const ClaimStatusBreakdownSchema = z.object({
	status: RewardClaimStatusSchema,
	claims: CountSchema,
});

export type ClaimStatusBreakdown = z.output<typeof ClaimStatusBreakdownSchema>;

export const CustomerAnalyticsDashboardSchema = z.object({
	range: AnalyticsReportRangeSchema,
	currency: SaleCurrencySchema,
	totals: CustomerDashboardTotalsSchema,
	/** Spending, visits, claims and redemptions per bucket. */
	series: z.array(CustomerDashboardPointSchema),
	/** Highest spend first. */
	spendingByCategory: z.array(CustomerCategorySpendSchema),
	/** Highest spend first, at most `CUSTOMER_TOP_MERCHANTS_LIMIT`. */
	spendingByMerchant: z.array(CustomerMerchantSpendSchema),
	/** The range's claims by current status (pending / redeemed / expired), in `RewardClaimStatusSchema` order. */
	claimsByStatus: z.array(ClaimStatusBreakdownSchema),
});

export type CustomerAnalyticsDashboard = z.output<typeof CustomerAnalyticsDashboardSchema>;

/** Merchants listed (each with a series) in the customer's spending breakdown. */
export const CUSTOMER_TOP_MERCHANTS_LIMIT = 5;
