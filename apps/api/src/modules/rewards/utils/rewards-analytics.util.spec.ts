import { describe, expect, it } from "vitest";

import { averageBillMinor, buildWeeklySalesSeries } from "./rewards-analytics.util";

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
	const period = { fromMs: MONDAY, toMs: MONDAY + 20 * DAY_MS };

	it("returns every week of the period, empty weeks as zero", () => {
		const series = buildWeeklySalesSeries(period, []);

		expect(series.map((week) => week.date)).toEqual([MONDAY, MONDAY + 7 * DAY_MS, MONDAY + 14 * DAY_MS]);
		expect(series.every((week) => week.salesMinor === 0 && week.bills === 0)).toBe(true);
	});

	it("sums bills into their UTC week and ignores bills outside the period", () => {
		const series = buildWeeklySalesSeries(period, [
			{ paidAt: MONDAY + DAY_MS, billTotalMinor: 1500 },
			{ paidAt: MONDAY + 6 * DAY_MS, billTotalMinor: 500 },
			{ paidAt: MONDAY + 8 * DAY_MS, billTotalMinor: 1200 },
			{ paidAt: MONDAY - DAY_MS, billTotalMinor: 9999 },
			{ paidAt: period.toMs + 1, billTotalMinor: 9999 },
		]);

		expect(series).toEqual([
			{ date: MONDAY, salesMinor: 2000, bills: 2 },
			{ date: MONDAY + 7 * DAY_MS, salesMinor: 1200, bills: 1 },
			{ date: MONDAY + 14 * DAY_MS, salesMinor: 0, bills: 0 },
		]);
	});
});
