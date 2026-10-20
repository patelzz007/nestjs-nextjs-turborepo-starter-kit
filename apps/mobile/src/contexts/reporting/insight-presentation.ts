// What the Analytics screen's extra sections show: the period comparison and
// the category split (from the API's dashboard contract) and the highlights,
// times of day, budget, stamp cards and recent visits (from ActivityInsights),
// shaped as the chart components take them. Pure, so every label is tested
// without rendering.

import {
	DAY_MS,
	PLATFORM_DISPLAY_REGION,
	type AnalyticsComparison,
	type AnalyticsReportRange,
	type CustomerAnalyticsDashboard,
	type CustomerCategorySpend,
	type CustomerMerchantSpend,
} from "@workspace/shared";
import CalendarDaysIcon from "lucide-react-native/icons/calendar-days";
import PiggyBankIcon from "lucide-react-native/icons/piggy-bank";
import ReceiptIcon from "lucide-react-native/icons/receipt";
import StoreIcon from "lucide-react-native/icons/store";

import type { BadgeTone } from "@workspace/ui-native/components/badge";
import type { ChartColor } from "../../components/chart-colors";
import type { ColumnDatum } from "../../components/column-chart";
import type { ComparisonItem } from "../../components/comparison-bars";
import type { DetailItem } from "@workspace/ui-native/components/detail-list";
import type { HeatmapLabel } from "../../components/heatmap-grid";
import type { HighlightItem } from "../../components/highlight-grid";
import type { ProgressItem } from "../../components/progress-list";
import type { RankedBarItem } from "../../components/ranked-bar-list";
import type { ShareSegment } from "../../components/share-legend";
import type { TimelineItem } from "@workspace/ui-native/components/timeline";
import {
	DAY_PART_HOURS,
	DayPartSchema,
	WeekdaySchema,
	type ActivityInsights,
	type ActivityVisit,
	type DayPart,
	type MonthBudget,
	type StampCard,
	type VisitReward,
	type Weekday,
} from "./activity-insights";
import type { ActivitySelection } from "./activity-range";
import { categoryLabelOf, rangeLabelOf, type ActivityFormatters } from "./presentation";

const LOCALE = PLATFORM_DISPLAY_REGION.locale;

/** The API's percent units (12.5 = 12.5 %). */
const PERCENT_SCALE = 100;
const HOURS_PER_DAY = 24;
const HOUR_MS = DAY_MS / HOURS_PER_DAY;

function shareOf(part: number, whole: number): number {
	return whole === 0 ? 0 : (part / whole) * PERCENT_SCALE;
}

function countLabel(count: number, singular: string, plural: string, formatters: ActivityFormatters): string {
	return `${formatters.count(count)} ${count === 1 ? singular : plural}`;
}

/** "14 visits", "1 visit". */
export function visitsLabelOf(count: number, formatters: ActivityFormatters): string {
	return countLabel(count, "visit", "visits", formatters);
}

// ── Weekdays and parts of the day ─────────────────────────────────────────

/** A Monday (5 Jan 2026, UTC): the weekday names are read off the week that starts on it. */
const REFERENCE_MONDAY_MS = Date.UTC(2026, 0, 5);

const WEEKDAY_SHORT = new Intl.DateTimeFormat(LOCALE, { weekday: "short", timeZone: "UTC" });
const WEEKDAY_LONG = new Intl.DateTimeFormat(LOCALE, { weekday: "long", timeZone: "UTC" });

/** A weekday's names ("Sat", "Saturday") in the platform locale. */
export function weekdayLabelOf(weekday: Weekday): HeatmapLabel {
	const dayMs = REFERENCE_MONDAY_MS + WeekdaySchema.options.indexOf(weekday) * DAY_MS;
	return { key: weekday, label: WEEKDAY_SHORT.format(dayMs), fullLabel: WEEKDAY_LONG.format(dayMs) };
}

/** How each part of the day is named and coloured: fixed per part, never by rank. */
export const DAY_PART_DISPLAY: Readonly<Record<DayPart, { readonly label: string; readonly color: ChartColor }>> = {
	morning: { label: "Morning", color: "chart-1" },
	midday: { label: "Midday", color: "chart-2" },
	afternoon: { label: "Afternoon", color: "chart-3" },
	evening: { label: "Evening", color: "chart-4" },
};

const HOUR_FORMAT = new Intl.DateTimeFormat(LOCALE, { hour: "numeric", timeZone: "UTC" });

/** "Morning (7 am – 11 am)": a part of the day with its hours. */
export function dayPartFullLabelOf(part: DayPart): string {
	const hours = DAY_PART_HOURS[part];
	return `${DAY_PART_DISPLAY[part].label} (${HOUR_FORMAT.format(hours.fromHour * HOUR_MS)} – ${HOUR_FORMAT.format(hours.toHour * HOUR_MS)})`;
}

function totalVisitsOn(insights: ActivityInsights, weekday: Weekday): number {
	const parts = insights.visitsByWeekday[weekday];
	return DayPartSchema.options.reduce((total: number, part: DayPart): number => total + parts[part], 0);
}

/** The range's visits per weekday, Monday first. */
export function weekdayColumnsOf(insights: ActivityInsights, formatters: ActivityFormatters): readonly ColumnDatum[] {
	return WeekdaySchema.options.map((weekday: Weekday): ColumnDatum => {
		const label = weekdayLabelOf(weekday);
		const visits = totalVisitsOn(insights, weekday);
		return { key: weekday, label: label.label, fullLabel: label.fullLabel, value: visits, valueLabel: visitsLabelOf(visits, formatters) };
	});
}

/** The heatmap of visits: a row per part of the day, a column per weekday. */
export interface VisitHeatmap {
	readonly rows: readonly HeatmapLabel[];
	readonly columns: readonly HeatmapLabel[];
	readonly values: readonly (readonly number[])[];
}

export function visitHeatmapOf(insights: ActivityInsights): VisitHeatmap {
	return {
		rows: DayPartSchema.options.map((part: DayPart): HeatmapLabel => ({ key: part, label: DAY_PART_DISPLAY[part].label, fullLabel: dayPartFullLabelOf(part) })),
		columns: WeekdaySchema.options.map(weekdayLabelOf),
		values: DayPartSchema.options.map((part: DayPart): readonly number[] => WeekdaySchema.options.map((weekday: Weekday): number => insights.visitsByWeekday[weekday][part])),
	};
}

/** The range's spend by part of the day, as parts of the whole. */
export function dayPartSegmentsOf(insights: ActivityInsights, formatters: ActivityFormatters): readonly ShareSegment[] {
	const total = DayPartSchema.options.reduce((sum: number, part: DayPart): number => sum + insights.spendByDayPart[part], 0);
	return DayPartSchema.options.map((part: DayPart): ShareSegment => ({
		key: part,
		label: DAY_PART_DISPLAY[part].label,
		color: DAY_PART_DISPLAY[part].color,
		value: insights.spendByDayPart[part],
		valueLabel: formatters.money(insights.spendByDayPart[part]),
		shareLabel: formatters.percent(shareOf(insights.spendByDayPart[part], total)),
	}));
}

// ── This period against the previous one ──────────────────────────────────

/** Said instead of a change when the previous period had nothing. */
export const NEW_THIS_PERIOD_LABEL = "New this period";

function changeLabelOf(comparison: AnalyticsComparison, formatters: ActivityFormatters): string {
	return comparison.changePercent === null ? NEW_THIS_PERIOD_LABEL : formatters.percentChange(comparison.changePercent);
}

/**
 * The two periods' names: "Last 30 days" and "Previous 30 days" for a preset,
 * the days themselves for custom dates ("1 Sep – 15 Sep 2026"), which need
 * not end today.
 */
export function periodNamesOf(range: AnalyticsReportRange, selection: ActivitySelection): { readonly current: string; readonly previous: string } {
	if (selection.kind === "custom") {
		return { current: rangeLabelOf(range), previous: rangeLabelOf({ from: range.previousFrom, to: range.previousTo, timeZone: range.timeZone }) };
	}
	const days = String(Math.round((range.to - range.from) / DAY_MS));
	return { current: `Last ${days} days`, previous: `Previous ${days} days` };
}

const AS_OF_FORMAT = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "as of 12 Oct 2026": the range's last day, for what is counted up to it. */
export function asOfLabelOf(range: AnalyticsReportRange): string {
	return `as of ${AS_OF_FORMAT.format(range.to - 1)}`;
}

type ComparedTotal = "spentMinor" | "visits" | "claims" | "redemptions" | "merchants";

const COMPARED_TOTALS: readonly { readonly key: ComparedTotal; readonly label: string; readonly isMoney: boolean }[] = [
	{ key: "spentMinor", label: "Spent", isMoney: true },
	{ key: "visits", label: "Shop visits", isMoney: false },
	{ key: "merchants", label: "Shops visited", isMoney: false },
	{ key: "claims", label: "Rewards claimed", isMoney: false },
	{ key: "redemptions", label: "Rewards redeemed", isMoney: false },
];

export function comparisonItemsOf(dashboard: CustomerAnalyticsDashboard, formatters: ActivityFormatters): readonly ComparisonItem[] {
	return COMPARED_TOTALS.map((total): ComparisonItem => {
		const comparison = dashboard.totals[total.key];
		const format = total.isMoney ? formatters.money : formatters.count;
		return {
			key: total.key,
			label: total.label,
			current: comparison.value,
			previous: comparison.previous,
			currentLabel: format(comparison.value),
			previousLabel: format(comparison.previous),
			changeLabel: changeLabelOf(comparison, formatters),
		};
	});
}

// ── Categories ────────────────────────────────────────────────────────────

/** Spending per category, highest first, with its share and visits ("38.2% · 12 visits"). */
export function categoryItemsOf(dashboard: CustomerAnalyticsDashboard, formatters: ActivityFormatters): readonly RankedBarItem[] {
	return dashboard.spendingByCategory.map((row: CustomerCategorySpend): RankedBarItem => ({
		key: row.category ?? "uncategorised",
		label: categoryLabelOf(row.category),
		detail: `${formatters.percent(shareOf(row.totalMinor, dashboard.totals.spentMinor.value))} · ${visitsLabelOf(row.visits, formatters)}`,
		value: row.totalMinor,
		valueLabel: formatters.money(row.totalMinor),
	}));
}

// ── Highlights ────────────────────────────────────────────────────────────

const VISIT_DAY_FORMAT = new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function busiestWeekdayOf(insights: ActivityInsights): Weekday {
	return WeekdaySchema.options.reduce(
		(busiest: Weekday, weekday: Weekday): Weekday => (totalVisitsOn(insights, weekday) > totalVisitsOn(insights, busiest) ? weekday : busiest),
		"monday",
	);
}

function favouriteShopOf(dashboard: CustomerAnalyticsDashboard): CustomerMerchantSpend | null {
	return dashboard.spendingByMerchant.reduce(
		(favourite: CustomerMerchantSpend | null, shop: CustomerMerchantSpend): CustomerMerchantSpend => (favourite === null || shop.visits > favourite.visits ? shop : favourite),
		null,
	);
}

/** Four standout facts of the range: the busiest day, the favourite shop, the biggest bill and what rewards saved. */
export function highlightsOf(dashboard: CustomerAnalyticsDashboard, insights: ActivityInsights, formatters: ActivityFormatters): readonly HighlightItem[] {
	const busiest = busiestWeekdayOf(insights);
	const favourite = favouriteShopOf(dashboard);
	const bill = insights.biggestBill;
	const saved = insights.savedMinor;
	return [
		{
			key: "busiest-day",
			icon: CalendarDaysIcon,
			label: "Busiest day",
			value: weekdayLabelOf(busiest).fullLabel,
			detail: visitsLabelOf(totalVisitsOn(insights, busiest), formatters),
		},
		{
			key: "favourite-shop",
			icon: StoreIcon,
			label: "Favourite shop",
			value: favourite?.merchantName ?? "None yet",
			detail: favourite === null ? "No visits" : visitsLabelOf(favourite.visits, formatters),
		},
		{
			key: "biggest-bill",
			icon: ReceiptIcon,
			label: "Biggest bill",
			value: bill === null ? formatters.money(0) : formatters.money(bill.billMinor),
			detail: bill === null ? "No visits" : `${bill.merchantName} · ${VISIT_DAY_FORMAT.format(bill.at)}`,
		},
		{
			key: "saved",
			icon: PiggyBankIcon,
			label: "Saved with rewards",
			value: formatters.money(saved.value),
			detail: saved.changePercent === null ? NEW_THIS_PERIOD_LABEL : `${formatters.percentChange(saved.changePercent)} on before`,
		},
	];
}

// ── Budget ────────────────────────────────────────────────────────────────

/** The month's budget as the ring and the lines beside it show it. */
export interface BudgetView {
	readonly value: number;
	readonly max: number;
	/** In the ring ("69%"). */
	readonly valueLabel: string;
	readonly caption: string;
	/** The days counted ("1 Oct – 12 Oct 2026"). */
	readonly periodLabel: string;
	/** "RM 412.30 of RM 600.00". */
	readonly accessibilityValueText: string;
	/** Spent, left (or over by), days to go and the month at this pace. */
	readonly details: readonly DetailItem[];
}

export function budgetViewOf(budget: MonthBudget, formatters: ActivityFormatters): BudgetView {
	const left = budget.budgetMinor - budget.spentMinor;
	const isOver = left < 0;
	const daysLeft = budget.daysInMonth - budget.daysElapsed;
	const projected = budget.daysElapsed === 0 ? 0 : Math.round((budget.spentMinor / budget.daysElapsed) * budget.daysInMonth);
	return {
		value: budget.spentMinor,
		max: budget.budgetMinor,
		valueLabel: formatters.percent(shareOf(budget.spentMinor, budget.budgetMinor)),
		caption: "of budget",
		periodLabel: rangeLabelOf({ from: budget.from, to: budget.to, timeZone: "UTC" }),
		accessibilityValueText: `${formatters.money(budget.spentMinor)} of ${formatters.money(budget.budgetMinor)}`,
		details: [
			{ label: "Spent", value: formatters.money(budget.spentMinor) },
			{ label: isOver ? "Over by" : "Left", value: formatters.money(Math.abs(left)) },
			{ label: "Days to go", value: formatters.count(daysLeft) },
			{ label: "At this pace", value: formatters.money(projected) },
		],
	};
}

// ── Stamp cards ───────────────────────────────────────────────────────────

/** Each card's stamps ("7 of 10") and what is left ("Free kopi · 3 more visits"). */
export function stampItemsOf(cards: readonly StampCard[], formatters: ActivityFormatters): readonly ProgressItem[] {
	return cards.map((card: StampCard): ProgressItem => {
		const toGo = card.stampsPerReward - card.stamps;
		return {
			key: card.organizationId,
			label: card.merchantName,
			detail: `${card.rewardName} · ${toGo === 1 ? "1 more visit" : `${formatters.count(toGo)} more visits`}`,
			value: card.stamps,
			max: card.stampsPerReward,
			valueLabel: `${formatters.count(card.stamps)} of ${formatters.count(card.stampsPerReward)}`,
		};
	});
}

// ── Recent visits ─────────────────────────────────────────────────────────

const VISIT_REWARD_BADGES: Readonly<Record<VisitReward, { readonly label: string; readonly tone: BadgeTone } | null>> = {
	none: null,
	claimed: { label: "Reward claimed", tone: "neutral" },
	redeemed: { label: "Reward redeemed", tone: "success" },
};

/** The latest visits on a timeline ("Sat, 10 Oct · 7:42 pm · Café"). */
export function timelineItemsOf(visits: readonly ActivityVisit[], formatters: ActivityFormatters, timeZone: AnalyticsReportRange["timeZone"]): readonly TimelineItem[] {
	const day = new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", month: "short", timeZone });
	const time = new Intl.DateTimeFormat(LOCALE, { hour: "numeric", minute: "2-digit", timeZone });
	return visits.map((visit: ActivityVisit): TimelineItem => {
		const badge = VISIT_REWARD_BADGES[visit.reward];
		return {
			key: visit.id,
			title: visit.merchantName,
			detail: `${day.format(visit.at)} · ${time.format(visit.at)} · ${categoryLabelOf(visit.category)}`,
			value: formatters.money(visit.billMinor),
			...(badge === null ? {} : { badge }),
		};
	});
}
