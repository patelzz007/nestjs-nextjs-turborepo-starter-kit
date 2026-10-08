import { describe, expect, it } from "vitest";
import { LIST_SLOT_INDEX } from "@workspace/shared";

import { averageBillMinor, buildWeeklySalesSeries, buildWeeklyTimeSeries, resolveAnalyticsPeriod } from "./rewards-analytics.util";

const DAY_MS = 86_400_000;
/** Monday 2026-09-07 00:00 UTC. */
const MONDAY = Date.UTC(2026, 8, 7);

describe("averageBillMinor", () => {
	it("rounds the mean bill to whole minor units and is 0 without bills", () => {
		expect(averageBillMinor(1000, 3)).toBe(333);
		expect(averageBillMinor(0, 0)).toBe(0);
	});
});

describe("buildWeeklySalesSeries", () => {
	const period = { fromMs: MONDAY, toMs: MONDAY + 20 * DAY_MS, timeZone: "UTC" };

	it("returns every week of the period, empty weeks as zero", () => {
		const series = buildWeeklySalesSeries(period, []);

		expect(series.map((week) => week.date)).toEqual([MONDAY, MONDAY + 7 * DAY_MS, MONDAY + 14 * DAY_MS]);
		expect(series.every((week) => week.salesMinor === 0 && week.bills === 0)).toBe(true);
	});

	it("places the database's weekly totals on their week and ignores weeks outside the period", () => {
		const series = buildWeeklySalesSeries(period, [
			{ weekStartMs: MONDAY, totalMinor: 2000, bills: 2 },
			{ weekStartMs: MONDAY + 7 * DAY_MS, totalMinor: 1200, bills: 1 },
			{ weekStartMs: MONDAY - 7 * DAY_MS, totalMinor: 9999, bills: 9 },
		]);

		expect(series).toEqual([
			{ date: MONDAY, salesMinor: 2000, bills: 2 },
			{ date: MONDAY + 7 * DAY_MS, salesMinor: 1200, bills: 1 },
			{ date: MONDAY + 14 * DAY_MS, salesMinor: 0, bills: 0 },
		]);
	});
});

describe("resolveAnalyticsPeriod", () => {
	const WEDNESDAY_NOON = MONDAY + 2 * DAY_MS + DAY_MS / 2;

	it("aligns an explicit 'from' down to its UTC week start, so the first bucket is a whole week", () => {
		expect(resolveAnalyticsPeriod(WEDNESDAY_NOON, MONDAY + 20 * DAY_MS)).toEqual({ fromMs: MONDAY, toMs: MONDAY + 20 * DAY_MS, timeZone: "UTC" });
	});

	it("defaults to the current week plus the seven before it, ending now", () => {
		expect(resolveAnalyticsPeriod(undefined, undefined, WEDNESDAY_NOON)).toEqual({ fromMs: MONDAY - 7 * 7 * DAY_MS, toMs: WEDNESDAY_NOON, timeZone: "UTC" });
	});
});

describe("weekly buckets in the merchant's time zone", () => {
	const KL = "Asia/Kuala_Lumpur";
	/** Monday 2026-09-07 00:00 in Kuala Lumpur (UTC+8). */
	const KL_MONDAY = MONDAY - 8 * 3_600_000;

	it("puts a bill paid Monday 01:00 local into that local week (UTC bucketing would file it under the previous week)", () => {
		const period = resolveAnalyticsPeriod(KL_MONDAY, KL_MONDAY + 10 * DAY_MS, 0, KL);
		const mondayOneAm = KL_MONDAY + 3_600_000;

		const series = buildWeeklySalesSeries(period, [{ weekStartMs: KL_MONDAY, totalMinor: 900, bills: 1 }]);
		const claims = buildWeeklyTimeSeries(period, [mondayOneAm], []);

		expect(series.map((week) => week.date)).toEqual([KL_MONDAY, KL_MONDAY + 7 * DAY_MS]);
		expect(series[LIST_SLOT_INDEX.first]).toMatchObject({ date: KL_MONDAY, salesMinor: 900, bills: 1 });
		expect(claims[LIST_SLOT_INDEX.first]).toMatchObject({ date: KL_MONDAY, claims: 1 });
	});
});
