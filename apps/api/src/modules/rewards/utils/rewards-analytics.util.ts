import { nextWeekStartInTimeZone, resolveAnalyticsPeriodRange, startOfWeekInTimeZone, UTC_TIME_ZONE, type AnalyticsPeriodRange } from "@workspace/shared";

export type AnalyticsPeriod = AnalyticsPeriodRange;

/** Whole percent: `percentChange` rounds to integers. */
const PERCENT = 100;

/** Conversion rate keeps one decimal place: round on a per-mille scale, then divide back. */
const PER_MILLE = 1000;
const PER_MILLE_PER_PERCENT = PER_MILLE / PERCENT;

/**
 * The period a request covers, aligned so `fromMs` is a UTC week start (see
 * `resolveAnalyticsPeriodRange` in `@workspace/shared`). Every weekly bucket
 * is then a whole week, and the echoed `period.from` is the real start.
 */
export function resolveAnalyticsPeriod(from: number | undefined, to: number | undefined, nowMs: number = Date.now(), timeZone: string = UTC_TIME_ZONE): AnalyticsPeriod {
	return resolveAnalyticsPeriodRange(from, to, nowMs, timeZone);
}

/** The equally long period right before `period` (for the "vs previous period" change). */
export function previousAnalyticsPeriod(period: AnalyticsPeriod): AnalyticsPeriod {
	const duration = period.toMs - period.fromMs;
	return { fromMs: period.fromMs - duration, toMs: period.fromMs, timeZone: period.timeZone };
}

export function percentChange(current: number, previous: number): number | null {
	if (previous === 0) {
		return current === 0 ? null : PERCENT;
	}
	return Math.round(((current - previous) / previous) * PERCENT);
}

export function buildAnalyticsMetric(value: number, previous: number): { value: number; changePercent: number | null } {
	return { value, changePercent: percentChange(value, previous) };
}

export function conversionRatePercent(claims: number, redemptions: number): number {
	if (claims === 0) {
		return 0;
	}
	return Math.round((redemptions / claims) * PER_MILLE) / PER_MILLE_PER_PERCENT;
}

/** Every week start (Monday 00:00 in the period's zone) from the week containing `fromMs` through the one containing `toMs`. */
function weekStarts(period: AnalyticsPeriod): number[] {
	const starts: number[] = [];
	const last = startOfWeekInTimeZone(period.toMs, period.timeZone);
	for (let cursor = startOfWeekInTimeZone(period.fromMs, period.timeZone); cursor <= last; cursor = nextWeekStartInTimeZone(cursor, period.timeZone)) {
		starts.push(cursor);
	}
	return starts;
}

export function buildWeeklyTimeSeries(
	period: AnalyticsPeriod,
	claimTimestamps: readonly number[],
	redemptionTimestamps: readonly number[],
): readonly { date: number; claims: number; redemptions: number }[] {
	const buckets = new Map<number, { claims: number; redemptions: number }>(weekStarts(period).map((start) => [start, { claims: 0, redemptions: 0 }]));

	for (const at of claimTimestamps) {
		if (at < period.fromMs || at > period.toMs) {
			continue;
		}
		const bucket = buckets.get(startOfWeekInTimeZone(at, period.timeZone));
		if (bucket !== undefined) {
			bucket.claims += 1;
		}
	}

	for (const at of redemptionTimestamps) {
		if (at < period.fromMs || at > period.toMs) {
			continue;
		}
		const bucket = buckets.get(startOfWeekInTimeZone(at, period.timeZone));
		if (bucket !== undefined) {
			bucket.redemptions += 1;
		}
	}

	return [...buckets.entries()]
		.sort(([leftDate], [rightDate]) => leftDate - rightDate)
		.map(([date, counts]) => ({ date, claims: counts.claims, redemptions: counts.redemptions }));
}

/** Mean bill in minor units (0 when there were no bills). */
export function averageBillMinor(totalMinor: number, bills: number): number {
	return bills === 0 ? 0 : Math.round(totalMinor / bills);
}

/**
 * Paid bills per week (Monday 00:00 in the period's zone) across the period — every week
 * present, empty weeks as zero. `weeks` are the per-week totals the database
 * grouped (`RewardSaleRepository.listWeeklyTotals`); weeks outside the period are ignored.
 */
export function buildWeeklySalesSeries(
	period: AnalyticsPeriod,
	weeks: readonly { readonly weekStartMs: number; readonly totalMinor: number; readonly bills: number }[],
): readonly { date: number; salesMinor: number; bills: number }[] {
	const totalsByWeek = new Map(weeks.map((week) => [week.weekStartMs, week]));
	return weekStarts(period).map((start) => {
		const week = totalsByWeek.get(start);
		return { date: start, salesMinor: week?.totalMinor ?? 0, bills: week?.bills ?? 0 };
	});
}
