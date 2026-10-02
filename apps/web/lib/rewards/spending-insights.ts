import {
	MERCHANT_BUSINESS_CATEGORY_LABELS,
	UNCATEGORISED_MERCHANT_CATEGORY_LABEL,
	type MerchantBusinessCategory,
	type UserSpendByCategory,
	type UserSpendByMerchant,
	type UserSpendingSummary,
} from "@workspace/shared";
import { formatMinorUnits } from "@workspace/ui/lib/format/money";

/** The chart palette tokens, in the fixed order slices take them. */
export type SpendChartTone = "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5";

const SPEND_CHART_TONES: readonly [SpendChartTone, SpendChartTone, SpendChartTone, SpendChartTone, SpendChartTone] = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];

/**
 * How many slices the category chart draws — one per palette colour. With more
 * categories than that, the top ones keep their own slice and the tail is
 * folded into one "more categories" slice, so a hue is never reused.
 */
export const MAX_CATEGORY_SLICES = SPEND_CHART_TONES.length;

const PERCENT = 100;

/** Display label for a merchant business category; uncategorised spend reads "Other". */
export function getSpendCategoryLabel(category: MerchantBusinessCategory | null): string {
	return category === null ? UNCATEGORISED_MERCHANT_CATEGORY_LABEL : MERCHANT_BUSINESS_CATEGORY_LABELS[category];
}

/** `part` as a whole-number percentage of `total` (0–100); 0 when there is no total. */
export function shareOfTotalPercent(part: number, total: number): number {
	if (total <= 0 || part <= 0) {
		return 0;
	}
	return Math.min(PERCENT, Math.round((part / total) * PERCENT));
}

/** A share as text — a real but tiny share reads "<1%" rather than a misleading "0%". */
export function formatSharePercent(part: number, total: number): string {
	const percent = shareOfTotalPercent(part, total);
	if (percent === 0 && part > 0 && total > 0) {
		return "<1%";
	}
	return `${String(percent)}%`;
}

/** "1 visit" / "3 visits". */
export function formatVisitCount(visits: number): string {
	return `${visits.toLocaleString()} ${visits === 1 ? "visit" : "visits"}`;
}

/** One merchant row of "Where you spent the most" — display data only. */
export interface MerchantSpendRow {
	readonly organizationId: string;
	readonly merchantName: string;
	readonly categoryLabel: string;
	readonly amountLabel: string;
	readonly visitsLabel: string;
	/** Share of the period's total spend, 0–100 — drives the bar width. */
	readonly sharePercent: number;
	readonly shareLabel: string;
}

/** Ranked merchant rows (the API already orders them highest spend first). */
export function toMerchantSpendRows(byMerchant: readonly UserSpendByMerchant[], totalSpentMinor: number, currency: string): readonly MerchantSpendRow[] {
	return byMerchant.map((merchant: UserSpendByMerchant): MerchantSpendRow => ({
		organizationId: merchant.organizationId,
		merchantName: merchant.merchantName,
		categoryLabel: getSpendCategoryLabel(merchant.category),
		amountLabel: formatMinorUnits(merchant.totalMinor, currency),
		visitsLabel: formatVisitCount(merchant.visits),
		sharePercent: shareOfTotalPercent(merchant.totalMinor, totalSpentMinor),
		shareLabel: formatSharePercent(merchant.totalMinor, totalSpentMinor),
	}));
}

/** One slice of "What you spent on" — shared by the donut and its legend list. */
export interface CategorySpendSlice {
	/** Stable key, also the chart datum's name. */
	readonly key: string;
	readonly label: string;
	/** For a folded tail slice: the categories it groups, e.g. "Retail, Wellness". */
	readonly detail: string | undefined;
	readonly totalMinor: number;
	readonly amountLabel: string;
	readonly visitsLabel: string;
	readonly sharePercent: number;
	readonly shareLabel: string;
	readonly tone: SpendChartTone;
}

const TAIL_SLICE_KEY = "more-categories";
const UNCATEGORISED_SLICE_KEY = "uncategorised";

function toneAt(index: number): SpendChartTone {
	// Callers never pass an index past the palette; the fallback only satisfies the index type.
	return SPEND_CHART_TONES[index] ?? SPEND_CHART_TONES[0];
}

/**
 * Category slices, highest spend first, each with a fixed-order palette tone.
 * At most {@link MAX_CATEGORY_SLICES}: beyond that, the top categories keep a
 * slice each and the rest fold into one "N more categories" slice (its
 * `detail` names them), so nothing is dropped and no colour repeats.
 */
export function toCategorySpendSlices(byCategory: readonly UserSpendByCategory[], totalSpentMinor: number, currency: string): readonly CategorySpendSlice[] {
	const spent = byCategory.filter((row: UserSpendByCategory): boolean => row.totalMinor > 0);
	const needsTail = spent.length > MAX_CATEGORY_SLICES;
	const headCount = needsTail ? MAX_CATEGORY_SLICES - 1 : spent.length;

	const toSlice = (key: string, label: string, detail: string | undefined, totalMinor: number, visits: number, index: number): CategorySpendSlice => ({
		key,
		label,
		detail,
		totalMinor,
		amountLabel: formatMinorUnits(totalMinor, currency),
		visitsLabel: formatVisitCount(visits),
		sharePercent: shareOfTotalPercent(totalMinor, totalSpentMinor),
		shareLabel: formatSharePercent(totalMinor, totalSpentMinor),
		tone: toneAt(index),
	});

	const head = spent
		.slice(0, headCount)
		.map((row: UserSpendByCategory, index: number): CategorySpendSlice =>
			toSlice(row.category ?? UNCATEGORISED_SLICE_KEY, getSpendCategoryLabel(row.category), undefined, row.totalMinor, row.visits, index),
		);

	if (!needsTail) {
		return head;
	}

	const tail = spent.slice(headCount);
	const tailMinor = tail.reduce((sum: number, row: UserSpendByCategory): number => sum + row.totalMinor, 0);
	const tailVisits = tail.reduce((sum: number, row: UserSpendByCategory): number => sum + row.visits, 0);
	const tailDetail = tail.map((row: UserSpendByCategory): string => getSpendCategoryLabel(row.category)).join(", ");

	return [...head, toSlice(TAIL_SLICE_KEY, `${String(tail.length)} more categories`, tailDetail, tailMinor, tailVisits, headCount)];
}

/** The headline numbers above the breakdowns — formatted, with the period-over-period change. */
export interface SpendingTotals {
	readonly totalSpentLabel: string;
	readonly totalSpentChangePercent: number | null;
	readonly visitsLabel: string;
	readonly visitsChangePercent: number | null;
}

/** What the "Your spending" section renders: every state is explicit, so none is impossible. */
export type SpendingSectionState =
	| { readonly status: "loading" }
	| { readonly status: "empty"; readonly totals: SpendingTotals }
	| { readonly status: "ready"; readonly totals: SpendingTotals; readonly merchants: readonly MerchantSpendRow[]; readonly categories: readonly CategorySpendSlice[] };

/**
 * Shapes the analytics `spending` block for the section. `empty` means no paid
 * bills in the period (no merchant to rank), so the breakdowns are replaced by
 * guidance while the — zero — totals and their trend still show.
 */
export function toSpendingSectionState(spending: UserSpendingSummary | undefined): SpendingSectionState {
	if (spending === undefined) {
		return { status: "loading" };
	}

	const totalSpentMinor = spending.totalSpentMinor.value;
	const totals: SpendingTotals = {
		totalSpentLabel: formatMinorUnits(totalSpentMinor, spending.currency),
		totalSpentChangePercent: spending.totalSpentMinor.changePercent,
		visitsLabel: spending.visits.value.toLocaleString(),
		visitsChangePercent: spending.visits.changePercent,
	};

	if (spending.byMerchant.length === 0) {
		return { status: "empty", totals };
	}

	return {
		status: "ready",
		totals,
		merchants: toMerchantSpendRows(spending.byMerchant, totalSpentMinor, spending.currency),
		categories: toCategorySpendSlices(spending.byCategory, totalSpentMinor, spending.currency),
	};
}
