export const DEFAULT_ANALYTICS_WEEKS = 8;

export interface AnalyticsPeriod {
	readonly fromMs: number;
	readonly toMs: number;
}

export function resolveAnalyticsPeriod(from: number | undefined, to: number | undefined): AnalyticsPeriod {
	const toMs = to ?? Date.now();
	const fromMs = from ?? toMs - DEFAULT_ANALYTICS_WEEKS * 7 * 24 * 60 * 60 * 1000;
	return { fromMs, toMs };
}

export function previousAnalyticsPeriod(period: AnalyticsPeriod): AnalyticsPeriod {
	const duration = period.toMs - period.fromMs;
	return { fromMs: period.fromMs - duration, toMs: period.fromMs };
}

export function percentChange(current: number, previous: number): number | null {
	if (previous === 0) {
		return current === 0 ? null : 100;
	}
	return Math.round(((current - previous) / previous) * 100);
}

export function buildAnalyticsMetric(value: number, previous: number): { value: number; changePercent: number | null } {
	return { value, changePercent: percentChange(value, previous) };
}

export function conversionRatePercent(claims: number, redemptions: number): number {
	if (claims === 0) {
		return 0;
	}
	return Math.round((redemptions / claims) * 1000) / 10;
}

function startOfWeekUtc(ms: number): number {
	const date = new Date(ms);
	const day = date.getUTCDay();
	const diff = (day + 6) % 7;
	date.setUTCHours(0, 0, 0, 0);
	return date.getTime() - diff * 86_400_000;
}

export function buildWeeklyTimeSeries(
	period: AnalyticsPeriod,
	claimTimestamps: readonly number[],
	redemptionTimestamps: readonly number[],
): readonly { date: number; claims: number; redemptions: number }[] {
	const weekStart = startOfWeekUtc(period.fromMs);
	const weekEnd = startOfWeekUtc(period.toMs);
	const buckets = new Map<number, { claims: number; redemptions: number }>();

	for (let cursor = weekStart; cursor <= weekEnd; cursor += 7 * 86_400_000) {
		buckets.set(cursor, { claims: 0, redemptions: 0 });
	}

	for (const at of claimTimestamps) {
		if (at < period.fromMs || at > period.toMs) {
			continue;
		}
		const key = startOfWeekUtc(at);
		const bucket = buckets.get(key);
		if (bucket !== undefined) {
			bucket.claims += 1;
		}
	}

	for (const at of redemptionTimestamps) {
		if (at < period.fromMs || at > period.toMs) {
			continue;
		}
		const key = startOfWeekUtc(at);
		const bucket = buckets.get(key);
		if (bucket !== undefined) {
			bucket.redemptions += 1;
		}
	}

	return [...buckets.entries()].sort((left, right) => left[0] - right[0]).map(([date, counts]) => ({ date, claims: counts.claims, redemptions: counts.redemptions }));
}
