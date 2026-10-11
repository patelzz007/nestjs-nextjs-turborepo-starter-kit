// ============================================
// Sample dashboard — the Analytics screen's data until it reads the API
// ============================================
// The screen is UI only for now: it makes no request. Its data has exactly the
// shape of `GET /claims/analytics/dashboard` (CustomerAnalyticsDashboard in
// @workspace/shared — the signed-in customer's own activity, which the web's
// "My Activity" page reads), built from the sample history (sample-activity.ts)
// for the range picked, so switching to the real endpoint changes the hook
// (use-activity-dashboard.ts) and nothing else.

import {
	CUSTOMER_TOP_MERCHANTS_LIMIT,
	DAY_MS,
	EpochMsSchema,
	RewardClaimStatusSchema,
	startOfWeekInTimeZone,
	WEEK_MS,
	type AnalyticsComparison,
	type AnalyticsInterval,
	type AnalyticsReportRange,
	type EpochMs,
	type AnalyticsSeriesValue,
	type ClaimStatusBreakdown,
	type CustomerAnalyticsDashboard,
	type CustomerCategorySpend,
	type CustomerDashboardPoint,
	type CustomerMerchantSpend,
	type MerchantBusinessCategory,
	type RewardClaimStatus,
} from "@workspace/shared";

import { ACTIVITY_TIME_ZONE } from "./activity-range";
import { daysOf, SAMPLE_BEHAVIOUR, SAMPLE_MERCHANTS, spentOf, sumOf, type SampleDay, type SampleMerchant, type SampleVisit } from "./sample-activity";

/**
 * Where the bucket holding `startMs` ends, before clipping: the next midnight,
 * Monday or 1st of the month. The activity zone is UTC, so a calendar month is
 * a UTC month.
 */
function nextBucketCut(startMs: number, interval: AnalyticsInterval): number {
	switch (interval) {
		case "day":
			return startMs - (startMs % DAY_MS) + DAY_MS;
		case "week":
			return startOfWeekInTimeZone(startMs, ACTIVITY_TIME_ZONE) + WEEK_MS;
		case "month": {
			const date = new Date(startMs);
			return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
		}
	}
}

interface Bucket {
	readonly start: EpochMs;
	readonly end: EpochMs;
	readonly isPartial: boolean;
}

/** The range cut into buckets; the first and last are clipped to it (`isPartial`), like the API's. */
export function bucketsOf(range: AnalyticsReportRange): readonly Bucket[] {
	const buckets: Bucket[] = [];
	let start: EpochMs = range.from;
	while (start < range.to) {
		const cut = nextBucketCut(start, range.interval);
		const end = EpochMsSchema.parse(Math.min(cut, range.to));
		buckets.push({ start, end, isPartial: !isBucketStart(start, range.interval) || end !== cut });
		start = end;
	}
	return buckets;
}

/** Whether `epochMs` is where a bucket naturally begins. */
function isBucketStart(epochMs: number, interval: AnalyticsInterval): boolean {
	switch (interval) {
		case "day":
			return epochMs % DAY_MS === 0;
		case "week":
			return startOfWeekInTimeZone(epochMs, ACTIVITY_TIME_ZONE) === epochMs;
		case "month":
			return new Date(epochMs).getUTCDate() === 1 && epochMs % DAY_MS === 0;
	}
}

/** The sums a period's KPIs are derived from. */
interface PeriodSums {
	readonly spentMinor: number;
	readonly visits: number;
	readonly claims: number;
	readonly redemptions: number;
	readonly merchants: number;
	readonly referralsSent: number;
	readonly referralsCredited: number;
}

function sumsOf(days: readonly SampleDay[]): PeriodSums {
	const merchants = new Set(days.flatMap((day: SampleDay): readonly string[] => day.visits.map((visit: SampleVisit): string => visit.merchant.organizationId)));
	return {
		spentMinor: sumOf(days, spentOf),
		visits: sumOf(days, (day: SampleDay): number => day.visits.length),
		claims: sumOf(days, (day: SampleDay): number => day.claims),
		redemptions: sumOf(days, (day: SampleDay): number => day.redemptions),
		merchants: merchants.size,
		referralsSent: sumOf(days, (day: SampleDay): number => day.referralsSent),
		referralsCredited: sumOf(days, (day: SampleDay): number => day.referralsCredited),
	};
}

/** Percent units, one decimal: the API's rounding. */
const PERCENT_SCALE = 100;
const ONE_DECIMAL = 10;

function roundToOneDecimal(value: number): number {
	return Math.round(value * ONE_DECIMAL) / ONE_DECIMAL;
}

/** A KPI against the previous period: `changePercent` is `null` when the previous period had nothing. */
export function compare(value: number, previous: number): AnalyticsComparison {
	const change = value - previous;
	return { value, previous, change, changePercent: previous === 0 ? null : roundToOneDecimal((change / previous) * PERCENT_SCALE) };
}

function averageBillOf(sums: PeriodSums): number {
	return sums.visits === 0 ? 0 : Math.round(sums.spentMinor / sums.visits);
}

function conversionRateOf(sums: PeriodSums): number {
	return sums.claims === 0 ? 0 : roundToOneDecimal((sums.redemptions / sums.claims) * PERCENT_SCALE);
}

function daysIn(days: readonly SampleDay[], bucket: Bucket): readonly SampleDay[] {
	return days.filter((day: SampleDay): boolean => day.startMs >= bucket.start && day.startMs < bucket.end);
}

function pointOf(days: readonly SampleDay[], bucket: Bucket): CustomerDashboardPoint {
	const sums = sumsOf(daysIn(days, bucket));
	return { ...bucket, spentMinor: sums.spentMinor, visits: sums.visits, claims: sums.claims, redemptions: sums.redemptions };
}

/** Spend and visits per bucket of the visits `matches` keeps. */
function spendSeriesOf(days: readonly SampleDay[], buckets: readonly Bucket[], matches: (visit: SampleVisit) => boolean): readonly AnalyticsSeriesValue[] {
	return buckets.map((bucket: Bucket): AnalyticsSeriesValue => ({
		start: bucket.start,
		totalMinor: daysIn(days, bucket)
			.flatMap((day: SampleDay): readonly SampleVisit[] => day.visits.filter(matches))
			.reduce((total: number, visit: SampleVisit): number => total + visit.billMinor, 0),
	}));
}

function visitsMatching(days: readonly SampleDay[], matches: (visit: SampleVisit) => boolean): readonly SampleVisit[] {
	return days.flatMap((day: SampleDay): readonly SampleVisit[] => day.visits.filter(matches));
}

function totalOf(visits: readonly SampleVisit[]): number {
	return visits.reduce((total: number, visit: SampleVisit): number => total + visit.billMinor, 0);
}

function merchantSpendOf(days: readonly SampleDay[], buckets: readonly Bucket[]): CustomerMerchantSpend[] {
	return SAMPLE_MERCHANTS.map((merchant: SampleMerchant): CustomerMerchantSpend => {
		const matches = (visit: SampleVisit): boolean => visit.merchant.organizationId === merchant.organizationId;
		const visits = visitsMatching(days, matches);
		return {
			organizationId: merchant.organizationId,
			merchantName: merchant.merchantName,
			category: merchant.category,
			totalMinor: totalOf(visits),
			visits: visits.length,
			series: [...spendSeriesOf(days, buckets, matches)],
		};
	})
		.filter((spend: CustomerMerchantSpend): boolean => spend.totalMinor > 0)
		.sort((left: CustomerMerchantSpend, right: CustomerMerchantSpend): number => right.totalMinor - left.totalMinor)
		.slice(0, CUSTOMER_TOP_MERCHANTS_LIMIT);
}

function categorySpendOf(days: readonly SampleDay[], buckets: readonly Bucket[]): CustomerCategorySpend[] {
	const categories = [...new Set(SAMPLE_MERCHANTS.map((merchant: SampleMerchant): MerchantBusinessCategory => merchant.category))];
	return categories
		.map((category: MerchantBusinessCategory): CustomerCategorySpend => {
			const matches = (visit: SampleVisit): boolean => visit.merchant.category === category;
			const visits = visitsMatching(days, matches);
			return { category, totalMinor: totalOf(visits), visits: visits.length, series: [...spendSeriesOf(days, buckets, matches)] };
		})
		.filter((spend: CustomerCategorySpend): boolean => spend.totalMinor > 0)
		.sort((left: CustomerCategorySpend, right: CustomerCategorySpend): number => right.totalMinor - left.totalMinor);
}

/**
 * The range's claims by where they stand now: redeemed, still usable (claimed
 * within the validity window before the range's end) or expired. Every status,
 * in the contract's order.
 */
function claimsByStatusOf(days: readonly SampleDay[], rangeEndMs: number): ClaimStatusBreakdown[] {
	const usableSinceMs = rangeEndMs - SAMPLE_BEHAVIOUR.claimValidityDays * DAY_MS;
	const counts: Readonly<Record<RewardClaimStatus, number>> = {
		REDEEMED: sumOf(days, (day: SampleDay): number => day.redemptions),
		PENDING: sumOf(
			days.filter((day: SampleDay): boolean => day.startMs >= usableSinceMs),
			(day: SampleDay): number => day.claims - day.redemptions,
		),
		EXPIRED: sumOf(
			days.filter((day: SampleDay): boolean => day.startMs < usableSinceMs),
			(day: SampleDay): number => day.claims - day.redemptions,
		),
	};
	return RewardClaimStatusSchema.options.map((status: RewardClaimStatus): ClaimStatusBreakdown => ({ status, claims: counts[status] }));
}

/** The sample customer's activity over `range` (and the period before it). */
export function sampleActivityDashboard(range: AnalyticsReportRange): CustomerAnalyticsDashboard {
	const days = daysOf(range.from, range.to);
	const current = sumsOf(days);
	const previous = sumsOf(daysOf(range.previousFrom, range.previousTo));
	const buckets = bucketsOf(range);
	return {
		range,
		currency: "MYR",
		totals: {
			spentMinor: compare(current.spentMinor, previous.spentMinor),
			visits: compare(current.visits, previous.visits),
			averageBillMinor: compare(averageBillOf(current), averageBillOf(previous)),
			claims: compare(current.claims, previous.claims),
			redemptions: compare(current.redemptions, previous.redemptions),
			conversionRate: compare(conversionRateOf(current), conversionRateOf(previous)),
			merchants: compare(current.merchants, previous.merchants),
			referralsSent: compare(current.referralsSent, previous.referralsSent),
			referralsCredited: compare(current.referralsCredited, previous.referralsCredited),
			// Every credited referral earns the referrer one reward.
			referralRewardsEarned: compare(current.referralsCredited, previous.referralsCredited),
		},
		series: buckets.map((bucket: Bucket): CustomerDashboardPoint => pointOf(days, bucket)),
		spendingByCategory: categorySpendOf(days, buckets),
		spendingByMerchant: merchantSpendOf(days, buckets),
		claimsByStatus: claimsByStatusOf(days, range.to),
	};
}
