// ============================================
// lib/analytics/analytics-presentation.ts - analytics API data → display data for the shared primitives
// ============================================
// The packages/ui analytics primitives (KpiStatCard, TimeSeriesChart,
// RankedBarList, ShareBar, AnalyticsRangePicker) know nothing about the API;
// these pure helpers turn the dashboard contracts into their props, once, for
// the customer, merchant and admin apps. Every formatter takes the locale and
// the report's time zone explicitly.

import {
	addLocalDays,
	LocalDateSchema,
	PLATFORM_DISPLAY_REGION,
	startOfLocalDateInTimeZone,
	type AnalyticsBucket,
	type AnalyticsComparison,
	type AnalyticsInterval,
	type AnalyticsReportRange,
	type DisplayRegion,
	type SaleCurrency,
} from "@workspace/shared";
import { CHART_LOADING, CHART_READY, type ChartFrameState } from "@workspace/ui/components/analytics/analytics-panel";
import type { KpiChange } from "@workspace/ui/components/analytics/kpi-stat-card";
import type { PickerOption, AnalyticsRangePickerLabels } from "@workspace/ui/components/analytics/analytics-range-picker";
import type { TimeSeriesChartLabels, TimeSeriesDefinition, TimeSeriesPoint } from "@workspace/ui/components/analytics/time-series-chart";
import { formatBucket, formatEpochMsRange } from "@workspace/ui/lib/format/date-time";
import { formatMinorUnits, formatMinorUnitsCompact } from "@workspace/ui/lib/format/money";
import { formatCount, formatPercent, formatPercentChange } from "@workspace/ui/lib/format/number";
import type { LucideIcon } from "lucide-react";

import type { AnalyticsRangePreset } from "./analytics-range";

/** The presets in the order the picker lists them. */
export const ANALYTICS_RANGE_PRESET_OPTIONS: readonly PickerOption<AnalyticsRangePreset>[] = [
	{ value: "last7Days", label: "Last 7 days" },
	{ value: "last30Days", label: "Last 30 days" },
	{ value: "last90Days", label: "Last 90 days" },
	{ value: "thisMonth", label: "This month" },
	{ value: "lastMonth", label: "Last month" },
	{ value: "thisQuarter", label: "This quarter" },
	{ value: "yearToDate", label: "Year to date" },
	{ value: "last12Months", label: "Last 12 months" },
	{ value: "custom", label: "Custom range" },
];

export const ANALYTICS_INTERVAL_OPTIONS: readonly PickerOption<AnalyticsInterval>[] = [
	{ value: "day", label: "Day" },
	{ value: "week", label: "Week" },
	{ value: "month", label: "Month" },
];

export const ANALYTICS_RANGE_PICKER_LABELS: AnalyticsRangePickerLabels = {
	range: "Date range",
	customDays: "Days",
	pickDays: "Pick the first and last day",
	apply: "Apply",
	interval: "Group by",
};

/** Calendar-day dates, written without a zone: the days a person picked ARE the report's days. */
const PICKED_DAY_REGION_ZONE = "UTC";

/**
 * Custom days as the calendar trigger shows them — "1 – 30 Sept 2026", or the
 * first day alone while the second is being picked. `YYYY-MM-DD` strings are
 * calendar days (no instant), so they are formatted as UTC midnights in UTC.
 */
export function formatCustomDays(days: { readonly from: string; readonly to: string }, locale: string): string {
	const region: DisplayRegion = { locale, timeZone: PICKED_DAY_REGION_ZONE };
	const from = LocalDateSchema.safeParse(days.from);
	if (!from.success) {
		return "";
	}
	const fromMs = startOfLocalDateInTimeZone(from.data, PICKED_DAY_REGION_ZONE);
	const to = LocalDateSchema.safeParse(days.to);
	const toMs = to.success ? startOfLocalDateInTimeZone(addLocalDays(to.data, 1), PICKED_DAY_REGION_ZONE) : fromMs + 1;
	return formatEpochMsRange(fromMs, toMs, region);
}

export const ANALYTICS_CHART_LABELS: TimeSeriesChartLabels = {
	partial: "partial",
	partialNote: "Shaded periods are cut off by the start or end of the range, so they cover fewer days.",
	showTable: "Show as table",
	period: "Period",
};

/** Shown instead of a percentage when the previous period had nothing to compare with. */
export const NO_PREVIOUS_PERIOD_LABEL = "No data in the previous period";

/** The region a report is rendered in: the platform's locale, the report's own time zone (`range.timeZone`). */
export function analyticsDisplayRegion(timeZone: string): DisplayRegion {
	return { locale: PLATFORM_DISPLAY_REGION.locale, timeZone };
}

/** The range in effect as text, with the zone its days are cut in: "6 Sep – 5 Oct 2026 · UTC". */
export function formatAnalyticsRangeLabel(fromMs: number, toMs: number, region: DisplayRegion): string {
	return `${formatEpochMsRange(fromMs, toMs, region)} · ${region.timeZone}`;
}

/** "vs 7 Aug – 5 Sep 2026" — what every KPI change is measured against. */
export function formatPreviousPeriodLabel(range: AnalyticsReportRange, region: DisplayRegion): string {
	return `vs ${formatEpochMsRange(range.previousFrom, range.previousTo, region)}`;
}

/** Whether a rise in the KPI is good news (sales) or not (none of today's KPIs, but the card supports it). */
export type KpiPolarity = "higherIsBetter" | "lowerIsBetter";

/**
 * A KPI comparison as the card's change line: direction from the sign of
 * `change`, sentiment from the KPI's polarity, the label as a signed percent.
 * `changePercent: null` (nothing in the previous period) is its own state.
 */
export function toKpiChange(comparison: AnalyticsComparison, polarity: KpiPolarity, locale: string): KpiChange {
	if (comparison.changePercent === null) {
		return { status: "noPrevious", label: NO_PREVIOUS_PERIOD_LABEL };
	}
	const label = formatPercentChange(comparison.changePercent, locale);
	if (comparison.change === 0) {
		return { status: "change", direction: "flat", sentiment: "neutral", label };
	}
	const isRise = comparison.change > 0;
	const isGood = polarity === "higherIsBetter" ? isRise : !isRise;
	return { status: "change", direction: isRise ? "up" : "down", sentiment: isGood ? "positive" : "negative", label };
}

/** A value in percent units (`87.8`) as "87.8%". */
export function formatPercentValue(percent: number, locale: string): string {
	return formatPercent(percent, locale);
}

/** Percent units of `part` in `total` (0 when the total is 0). */
const PERCENT_SCALE = 100;

/** `part` as a share of `total` ("64.3%"); "0%" for an empty total. */
export function formatShareOfTotal(part: number, total: number, locale: string): string {
	return formatPercent(total <= 0 ? 0 : (part / total) * PERCENT_SCALE, locale);
}

/** Chart-ready points of one chart, and whether every plotted value is zero (the chart then shows its empty state). */
export interface ChartSeriesData<TKey extends string> {
	readonly points: readonly TimeSeriesPoint<TKey>[];
	readonly isEmpty: boolean;
}

/**
 * API series points → the points of a chart plotting `series`. Generic over
 * the point type, so a series key that is not a numeric field of the point
 * does not compile; the point itself carries the values.
 */
export function toChartSeriesData<TKey extends string>(
	points: readonly (AnalyticsBucket & Readonly<Record<TKey, number>>)[],
	series: readonly TimeSeriesDefinition<TKey>[],
): ChartSeriesData<TKey> {
	return {
		points: points.map((point): TimeSeriesPoint<TKey> => ({ start: point.start, end: point.end, isPartial: point.isPartial, values: point })),
		isEmpty: points.every((point) => series.every((definition) => point[definition.key] === 0)),
	};
}

/** The x-axis tick and the full label of a bucket, cut at `interval` in `region`. */
export interface BucketFormatters {
	readonly tick: (point: { readonly start: number; readonly end: number }) => string;
	readonly label: (point: { readonly start: number; readonly end: number }) => string;
}

export function bucketFormatters(interval: AnalyticsInterval, region: DisplayRegion): BucketFormatters {
	return {
		tick: (point): string => formatBucket(point.start, point.end, interval, "axis", region),
		label: (point): string => formatBucket(point.start, point.end, interval, "full", region),
	};
}

/** Where a dashboard's one query stands, as its charts need it. */
export type AnalyticsDataStatus =
	{ readonly status: "loading" } | { readonly status: "error"; readonly message: string; readonly onRetry: () => void } | { readonly status: "ready" };

/** The retry button's label in every chart error state. */
export const ANALYTICS_RETRY_LABEL = "Try again";

/** A chart's frame: the query's loading / error state, else empty (with `emptyMessage`) or ready. */
export function toChartFrameState(data: AnalyticsDataStatus, isEmpty: boolean, emptyMessage: string): ChartFrameState {
	switch (data.status) {
		case "loading":
			return CHART_LOADING;
		case "error":
			return { status: "error", message: data.message, retryLabel: ANALYTICS_RETRY_LABEL, onRetry: data.onRetry };
		case "ready":
			return isEmpty ? { status: "empty", message: emptyMessage } : CHART_READY;
	}
}

// ── KPIs ───────────────────────────────────────────────────────────────────

/** How a KPI's value is written. */
export type KpiValueFormat = "money" | "count" | "percent";

/** One headline number of a dashboard: which total it reads and how it is written. */
export interface KpiDefinition<TKey extends string> {
	readonly key: TKey;
	readonly label: string;
	readonly format: KpiValueFormat;
	readonly icon?: LucideIcon;
	/** Default `higherIsBetter`. */
	readonly polarity?: KpiPolarity;
}

/** A KPI ready for `KpiStatCard`: `value` / `change` are `undefined` until the data arrives. */
export interface KpiView<TKey extends string> {
	readonly key: TKey;
	readonly label: string;
	readonly icon: LucideIcon | undefined;
	readonly value: string | undefined;
	readonly change: KpiChange | undefined;
}

/** The number formatters of one report (its currency, the platform locale). */
export interface AnalyticsFormatters {
	readonly locale: string;
	/** Minor units in full: "RM 1,234.50". */
	readonly money: (minor: number) => string;
	/** Minor units abbreviated for axes: "RM 1.2K". */
	readonly moneyCompact: (minor: number) => string;
	readonly count: (value: number) => string;
	/** Percent units: "87.8%". */
	readonly percent: (value: number) => string;
}

export function analyticsFormatters(currency: SaleCurrency, locale: string): AnalyticsFormatters {
	return {
		locale,
		money: (minor: number): string => formatMinorUnits(minor, currency, locale),
		moneyCompact: (minor: number): string => formatMinorUnitsCompact(minor, currency, locale),
		count: (value: number): string => formatCount(value, locale),
		percent: (value: number): string => formatPercent(value, locale),
	};
}

function formatKpiValue(value: number, format: KpiValueFormat, formatters: AnalyticsFormatters): string {
	switch (format) {
		case "money":
			return formatters.money(value);
		case "count":
			return formatters.count(value);
		case "percent":
			return formatters.percent(value);
	}
}

/** The KPI cards of `definitions`, read from a dashboard's `totals` (`undefined` while loading). */
export function toKpiViews<TKey extends string>(
	definitions: readonly KpiDefinition<TKey>[],
	totals: Readonly<Record<TKey, AnalyticsComparison>> | undefined,
	formatters: AnalyticsFormatters,
): readonly KpiView<TKey>[] {
	return definitions.map((definition): KpiView<TKey> => {
		const total = totals?.[definition.key];
		return {
			key: definition.key,
			label: definition.label,
			icon: definition.icon,
			value: total === undefined ? undefined : formatKpiValue(total.value, definition.format, formatters),
			change: total === undefined ? undefined : toKpiChange(total, definition.polarity ?? "higherIsBetter", formatters.locale),
		};
	});
}

/** Y-axis width (px) that fits compact money ticks ("RM 123.5K"); count axes use the chart's default. */
export const MONEY_AXIS_WIDTH_PX = 72;
