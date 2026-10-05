import type { AnalyticsComparison } from "@workspace/shared";

/** Percentages carry one decimal place: round on a per-mille scale, then divide back. */
const ONE_DECIMAL_SCALE = 10;
const PERCENT = 100;

/** `value` rounded to one decimal place. */
function roundToOneDecimal(value: number): number {
	return Math.round(value * ONE_DECIMAL_SCALE) / ONE_DECIMAL_SCALE;
}

/**
 * Relative change from `previous` to `value`, in percent with one decimal.
 * `null` when `previous` is 0: a change "from nothing" has no meaningful
 * percentage (the absolute `change` still says how much it grew).
 */
export function changePercent(value: number, previous: number): number | null {
	if (previous === 0) {
		return null;
	}
	return roundToOneDecimal(((value - previous) / Math.abs(previous)) * PERCENT);
}

/** One KPI compared with the previous range: the value, the base, the absolute and the relative change. */
export function compare(value: number, previous: number): AnalyticsComparison {
	return { value, previous, change: roundToOneDecimal(value - previous), changePercent: changePercent(value, previous) };
}

/** Redemptions ÷ claims in percent, one decimal; 0 without claims. */
export function conversionRate(claims: number, redemptions: number): number {
	return claims === 0 ? 0 : roundToOneDecimal((redemptions / claims) * PERCENT);
}

/** One value per bucket start, zero for a bucket without one (the series of a breakdown row). */
export function seriesFor(bucketStarts: readonly number[], totalsByStart: ReadonlyMap<number, number>): { readonly start: number; readonly totalMinor: number }[] {
	return bucketStarts.map((start) => ({ start, totalMinor: totalsByStart.get(start) ?? 0 }));
}
