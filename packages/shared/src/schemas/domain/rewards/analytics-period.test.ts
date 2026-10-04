import { describe, expect, it } from "vitest";

import {
	AdminSalesAnalyticsQuerySchema,
	analyticsQueryForWeeks,
	DAY_MS,
	DEFAULT_ANALYTICS_WEEKS,
	MAX_ANALYTICS_WEEKS,
	resolveAnalyticsPeriodRange,
	RewardsAnalyticsQuerySchema,
	startOfUtcWeekMs,
	WEEK_MS,
} from "./analytics";

/** Monday 2026-09-07 00:00 UTC. */
const MONDAY = Date.UTC(2026, 8, 7);
const SUNDAY_LATE = MONDAY + 6 * DAY_MS + DAY_MS - 1;

describe("analytics periods", () => {
	it("finds the Monday 00:00 UTC start of any instant's week", () => {
		expect(startOfUtcWeekMs(MONDAY)).toBe(MONDAY);
		expect(startOfUtcWeekMs(MONDAY + 3 * DAY_MS + 5)).toBe(MONDAY);
		expect(startOfUtcWeekMs(SUNDAY_LATE)).toBe(MONDAY);
		expect(startOfUtcWeekMs(SUNDAY_LATE + 1)).toBe(MONDAY + WEEK_MS);
	});

	it("aligns 'from' down to a week start and defaults to the last DEFAULT_ANALYTICS_WEEKS weeks", () => {
		expect(resolveAnalyticsPeriodRange(MONDAY + 2 * DAY_MS, MONDAY + 10 * DAY_MS, 0)).toEqual({ fromMs: MONDAY, toMs: MONDAY + 10 * DAY_MS, timeZone: "UTC" });
		expect(resolveAnalyticsPeriodRange(undefined, undefined, MONDAY + DAY_MS)).toEqual({
			fromMs: MONDAY - (DEFAULT_ANALYTICS_WEEKS - 1) * WEEK_MS,
			toMs: MONDAY + DAY_MS,
			timeZone: "UTC",
		});
	});

	it("aligns to Monday 00:00 in the merchant's own zone when one is given", () => {
		// Monday 2026-09-07 00:00 in Kuala Lumpur is Sunday 2026-09-06 16:00 UTC.
		expect(resolveAnalyticsPeriodRange(MONDAY + DAY_MS, MONDAY + 3 * DAY_MS, 0, "Asia/Kuala_Lumpur")).toEqual({
			fromMs: MONDAY - 8 * 3_600_000,
			toMs: MONDAY + 3 * DAY_MS,
			timeZone: "Asia/Kuala_Lumpur",
		});
	});

	it("builds an already aligned query for 'the last N weeks'", () => {
		expect(analyticsQueryForWeeks(4, MONDAY + DAY_MS)).toEqual({ from: MONDAY - 3 * WEEK_MS, to: MONDAY + DAY_MS });
	});

	it("rejects from ≥ to and periods longer than MAX_ANALYTICS_WEEKS", () => {
		expect(RewardsAnalyticsQuerySchema.safeParse({ from: MONDAY, to: MONDAY }).success).toBe(false);
		expect(AdminSalesAnalyticsQuerySchema.safeParse({ from: MONDAY - (MAX_ANALYTICS_WEEKS + 1) * WEEK_MS, to: MONDAY }).success).toBe(false);
		expect(AdminSalesAnalyticsQuerySchema.safeParse({ from: MONDAY - MAX_ANALYTICS_WEEKS * WEEK_MS, to: MONDAY }).success).toBe(true);
	});
});
