// What the Analytics screen shows, derived from a CustomerAnalyticsDashboard:
// the formatted numbers, each KPI's change, the bucket labels, the chart
// series and the breakdowns as the chart components take them. The KPI names,
// the claim-status names and colours are the web "My Activity" dashboard's
// (apps/web lib/rewards/customer-analytics.ts), so both apps say the same.
// Pure, so every label is tested without rendering.

import {
	DAY_MS,
	MERCHANT_BUSINESS_CATEGORY_LABELS,
	PLATFORM_DISPLAY_REGION,
	UNCATEGORISED_MERCHANT_CATEGORY_LABEL,
	type AnalyticsComparison,
	type AnalyticsInterval,
	type AnalyticsReportRange,
	type CustomerAnalyticsDashboard,
	type CustomerDashboardPoint,
	type CustomerDashboardTotals,
	type CustomerMerchantSpend,
	type ClaimStatusBreakdown,
	type MerchantBusinessCategory,
	type RewardClaimStatus,
	type SaleCurrency,
} from "@workspace/shared";

import type { ChartColor } from "../../components/chart-colors";
import type { KpiChange } from "../../components/kpi-tile";
import type { RankedBarItem } from "../../components/ranked-bar-list";
import type { ShareSegment } from "../../components/share-bar";
import type { StatTile } from "../../components/stat-tiles";
import type { TrendSeries } from "../../components/trend-chart";

const LOCALE = PLATFORM_DISPLAY_REGION.locale;

/** Sen per ringgit: the API sends money in minor units. */
const MINOR_UNITS_PER_MAJOR = 100;
/** The API's percent units (12.5 = 12.5 %) to Intl's fractions. */
const PERCENT_SCALE = 100;
/** Percentages are shown with at most one decimal, as the API rounds them. */
const PERCENT_DECIMALS = 1;

/** The number formatters of one dashboard (its currency, the platform locale). */
export interface ActivityFormatters {
	/** Minor units in full: "RM 1,234.50". */
	readonly money: (minor: number) => string;
	/** Minor units, whole ringgit, for an axis: "RM 100". */
	readonly moneyTick: (minor: number) => string;
	readonly count: (value: number) => string;
	/** Percent units: "87.8%". */
	readonly percent: (value: number) => string;
	/** A signed change in percent units: "+12.4%", "−3%", "0%". */
	readonly percentChange: (value: number) => string;
}

export function activityFormatters(currency: SaleCurrency): ActivityFormatters {
	const money = new Intl.NumberFormat(LOCALE, { style: "currency", currency });
	const moneyTick = new Intl.NumberFormat(LOCALE, { style: "currency", currency, maximumFractionDigits: 0, minimumFractionDigits: 0 });
	const count = new Intl.NumberFormat(LOCALE);
	const percent = new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: PERCENT_DECIMALS });
	const percentChange = new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: PERCENT_DECIMALS, signDisplay: "exceptZero" });
	return {
		money: (minor: number): string => money.format(minor / MINOR_UNITS_PER_MAJOR),
		moneyTick: (minor: number): string => moneyTick.format(minor / MINOR_UNITS_PER_MAJOR),
		count: (value: number): string => count.format(value),
		percent: (value: number): string => percent.format(value / PERCENT_SCALE),
		percentChange: (value: number): string => percentChange.format(value / PERCENT_SCALE),
	};
}

/** Shown instead of a change when the previous period had nothing to compare with (the web's words). */
export const NO_PREVIOUS_PERIOD_LABEL = "No data in the previous period";

/** A KPI's change against the previous period. Every KPI here is better higher. */
export function kpiChangeOf(comparison: AnalyticsComparison, formatters: ActivityFormatters): KpiChange {
	if (comparison.changePercent === null) {
		return { status: "noPrevious", label: NO_PREVIOUS_PERIOD_LABEL };
	}
	const label = formatters.percentChange(comparison.changePercent);
	if (comparison.change === 0) {
		return { status: "change", direction: "flat", sentiment: "neutral", label };
	}
	const isRise = comparison.change > 0;
	return { status: "change", direction: isRise ? "up" : "down", sentiment: isRise ? "positive" : "negative", label };
}

/** Whole days the range covers. */
function daysOf(range: Pick<AnalyticsReportRange, "from" | "to">): number {
	return Math.round((range.to - range.from) / DAY_MS);
}

/** "vs previous 30 days": what every change is measured against. */
export function comparisonLabelOf(range: AnalyticsReportRange): string {
	return `vs previous ${String(daysOf(range))} days`;
}

/** "13 Sep – 12 Oct 2026": the days a range covers (its end is exclusive). */
export function rangeLabelOf(range: Pick<AnalyticsReportRange, "from" | "to" | "timeZone">): string {
	const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", timeZone: range.timeZone });
	const dayMonthYear = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric", timeZone: range.timeZone });
	return `${dayMonth.format(range.from)} – ${dayMonthYear.format(range.to - 1)}`;
}

/** The bucket's label under the plot ("4 Oct") and in the readout ("Sat, 4 Oct"). */
export interface BucketLabels {
	readonly tick: string;
	readonly full: string;
}

const BUCKET_FORMATS: Readonly<
	Record<AnalyticsInterval, { readonly tick: Intl.DateTimeFormatOptions; readonly full: Intl.DateTimeFormatOptions; readonly fullPrefix: string }>
> = {
	day: { tick: { day: "numeric", month: "short" }, full: { weekday: "short", day: "numeric", month: "short" }, fullPrefix: "" },
	week: { tick: { day: "numeric", month: "short" }, full: { day: "numeric", month: "short" }, fullPrefix: "Week of " },
	month: { tick: { month: "short" }, full: { month: "long", year: "numeric" }, fullPrefix: "" },
};

/** Every bucket's labels, cut at the range's interval in its zone. */
export function bucketLabelsOf(dashboard: CustomerAnalyticsDashboard): readonly BucketLabels[] {
	const formats = BUCKET_FORMATS[dashboard.range.interval];
	const tick = new Intl.DateTimeFormat(LOCALE, { ...formats.tick, timeZone: dashboard.range.timeZone });
	const full = new Intl.DateTimeFormat(LOCALE, { ...formats.full, timeZone: dashboard.range.timeZone });
	return dashboard.series.map((point: CustomerDashboardPoint): BucketLabels => ({ tick: tick.format(point.start), full: `${formats.fullPrefix}${full.format(point.start)}` }));
}

const BUCKET_NOUNS: Readonly<Record<AnalyticsInterval, string>> = { day: "day", week: "week", month: "month" };

/** The readout's prompt before a bucket is picked. */
export function chartHintOf(range: AnalyticsReportRange): string {
	return `Touch the chart to see each ${BUCKET_NOUNS[range.interval]}`;
}

const BUCKET_COLUMN_LABELS: Readonly<Record<AnalyticsInterval, string>> = { day: "Day", week: "Week", month: "Month" };

/** The values table's first column ("Day", "Week"). */
export function bucketColumnLabelOf(range: AnalyticsReportRange): string {
	return BUCKET_COLUMN_LABELS[range.interval];
}

/** "per day" / "per week": how a chart's values are grouped. */
export function perBucketLabelOf(range: AnalyticsReportRange): string {
	return `per ${BUCKET_NOUNS[range.interval]}`;
}

// ── KPIs ───────────────────────────────────────────────────────────────────

type KpiFormat = "money" | "count" | "percent";

/** The KPI tiles under the headline, in the web's words, each with its trend over the buckets. */
export interface KpiDefinition {
	readonly key: keyof CustomerDashboardTotals;
	readonly label: string;
	readonly format: KpiFormat;
	readonly trend: (point: CustomerDashboardPoint) => number;
}

/** The headline: what the customer spent. */
export const HEADLINE_KPI: KpiDefinition = { key: "spentMinor", label: "Total spent", format: "money", trend: (point: CustomerDashboardPoint): number => point.spentMinor };

export const ACTIVITY_KPIS: readonly KpiDefinition[] = [
	{ key: "visits", label: "Shop visits", format: "count", trend: (point: CustomerDashboardPoint): number => point.visits },
	{
		key: "averageBillMinor",
		label: "Average bill",
		format: "money",
		trend: (point: CustomerDashboardPoint): number => (point.visits === 0 ? 0 : point.spentMinor / point.visits),
	},
	{ key: "claims", label: "Rewards claimed", format: "count", trend: (point: CustomerDashboardPoint): number => point.claims },
	{
		key: "conversionRate",
		label: "Redemption rate",
		format: "percent",
		trend: (point: CustomerDashboardPoint): number => (point.claims === 0 ? 0 : (point.redemptions / point.claims) * PERCENT_SCALE),
	},
];

/** A KPI tile's content. */
export interface KpiView {
	readonly key: keyof CustomerDashboardTotals;
	readonly label: string;
	readonly value: string;
	readonly change: KpiChange;
	readonly trend: readonly number[];
}

function formatKpi(value: number, format: KpiFormat, formatters: ActivityFormatters): string {
	switch (format) {
		case "money":
			return formatters.money(value);
		case "count":
			return formatters.count(value);
		case "percent":
			return formatters.percent(value);
	}
}

export function kpiViewOf(definition: KpiDefinition, dashboard: CustomerAnalyticsDashboard, formatters: ActivityFormatters): KpiView {
	const comparison = dashboard.totals[definition.key];
	return {
		key: definition.key,
		label: definition.label,
		value: formatKpi(comparison.value, definition.format, formatters),
		change: kpiChangeOf(comparison, formatters),
		trend: dashboard.series.map(definition.trend),
	};
}

/** The referral numbers, as plain stat tiles. */
export function referralTilesOf(totals: CustomerDashboardTotals, formatters: ActivityFormatters): StatTile[] {
	return [
		{ label: "Referrals sent", value: formatters.count(totals.referralsSent.value) },
		{ label: "Referrals credited", value: formatters.count(totals.referralsCredited.value) },
		{ label: "Rewards earned", value: formatters.count(totals.referralRewardsEarned.value) },
	];
}

/** Nothing happened in the range: the screen shows an empty state instead of flat charts. */
export function isEmptyActivity(totals: CustomerDashboardTotals): boolean {
	return totals.visits.value === 0 && totals.claims.value === 0 && totals.referralsSent.value === 0;
}

// ── Charts ─────────────────────────────────────────────────────────────────

export function spendingSeriesOf(dashboard: CustomerAnalyticsDashboard): readonly TrendSeries[] {
	return [{ key: "spentMinor", label: "Spent", color: "chart-1", values: dashboard.series.map((point: CustomerDashboardPoint): number => point.spentMinor) }];
}

/** Claimed and redeemed on one axis: both are counts of the same rewards. */
export function engagementSeriesOf(dashboard: CustomerAnalyticsDashboard): readonly TrendSeries[] {
	return [
		{ key: "claims", label: "Claimed", color: "chart-1", values: dashboard.series.map((point: CustomerDashboardPoint): number => point.claims) },
		{ key: "redemptions", label: "Redeemed", color: "chart-2", values: dashboard.series.map((point: CustomerDashboardPoint): number => point.redemptions) },
	];
}

/** How each claim status is named and coloured: fixed per status, never by rank (the web's mapping). */
export const CLAIM_STATUS_DISPLAY: Readonly<Record<RewardClaimStatus, { readonly label: string; readonly color: ChartColor }>> = {
	PENDING: { label: "Waiting to be used", color: "chart-1" },
	REDEEMED: { label: "Redeemed", color: "chart-2" },
	EXPIRED: { label: "Expired", color: "chart-3" },
};

/** The range's claims by status, as parts of the whole (every status, zero included). */
export function claimStatusSegmentsOf(dashboard: CustomerAnalyticsDashboard, formatters: ActivityFormatters): readonly ShareSegment[] {
	const total = dashboard.claimsByStatus.reduce((sum: number, row: ClaimStatusBreakdown): number => sum + row.claims, 0);
	return dashboard.claimsByStatus.map((row: ClaimStatusBreakdown): ShareSegment => ({
		key: row.status,
		label: CLAIM_STATUS_DISPLAY[row.status].label,
		color: CLAIM_STATUS_DISPLAY[row.status].color,
		value: row.claims,
		valueLabel: formatters.count(row.claims),
		shareLabel: formatters.percent(total === 0 ? 0 : (row.claims / total) * PERCENT_SCALE),
	}));
}

/** A merchant category's name; uncategorised spend reads "Other". */
export function categoryLabelOf(category: MerchantBusinessCategory | null): string {
	return category === null ? UNCATEGORISED_MERCHANT_CATEGORY_LABEL : MERCHANT_BUSINESS_CATEGORY_LABELS[category];
}

function visitsLabel(visits: number, formatters: ActivityFormatters): string {
	return `${formatters.count(visits)} ${visits === 1 ? "visit" : "visits"}`;
}

/** The top shops, highest spend first ("Kopi Kaki · Café · 4 visits · RM 58.20"). */
export function topShopItemsOf(dashboard: CustomerAnalyticsDashboard, formatters: ActivityFormatters): readonly RankedBarItem[] {
	return dashboard.spendingByMerchant.map((merchant: CustomerMerchantSpend): RankedBarItem => ({
		key: merchant.organizationId,
		label: merchant.merchantName,
		detail: `${categoryLabelOf(merchant.category)} · ${visitsLabel(merchant.visits, formatters)}`,
		value: merchant.totalMinor,
		valueLabel: formatters.money(merchant.totalMinor),
	}));
}
