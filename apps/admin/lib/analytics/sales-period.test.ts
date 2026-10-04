import { AdminSalesAnalyticsQuerySchema, DEFAULT_ANALYTICS_WEEKS, startOfUtcWeekMs, WEEK_MS } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { DEFAULT_SALES_PERIOD_WEEKS, resolveSalesPeriodQuery, SALES_PERIOD_PRESETS, salesPeriodLabel } from "@/lib/analytics/sales-period";
import { SALES_ANALYTICS_URL_STATE } from "@/lib/url-state/analytics";

/** Thursday 2026-10-01 12:00 UTC — mid-week, so alignment is visible. */
const NOW_MS = Date.UTC(2026, 9, 1, 12);
/** Monday 2026-09-28 00:00 UTC — the start of NOW_MS's UTC week. */
const CURRENT_WEEK_START_MS = Date.UTC(2026, 8, 28);

describe("SALES_ANALYTICS_URL_STATE", () => {
	it("reads every preset from ?weeks=", () => {
		for (const preset of SALES_PERIOD_PRESETS) {
			expect(SALES_ANALYTICS_URL_STATE.parse({ weeks: String(preset.weeks) }).weeks).toBe(preset.weeks);
		}
	});

	it("falls back to the API's default period for an absent, unknown or malformed value", () => {
		for (const weeks of [undefined, "5", "abc", "-4", ""]) {
			expect(SALES_ANALYTICS_URL_STATE.parse({ weeks }).weeks).toBe(DEFAULT_ANALYTICS_WEEKS);
		}
	});

	it("leaves the default out of links and keeps other presets", () => {
		expect(SALES_ANALYTICS_URL_STATE.href("/analytics/sales", { weeks: DEFAULT_SALES_PERIOD_WEEKS })).toBe("/analytics/sales");
		expect(SALES_ANALYTICS_URL_STATE.href("/analytics/sales", { weeks: 12 })).toBe("/analytics/sales?weeks=12");
	});
});

describe("resolveSalesPeriodQuery", () => {
	it("starts on a UTC week boundary and counts the current week as one", () => {
		expect(startOfUtcWeekMs(NOW_MS)).toBe(CURRENT_WEEK_START_MS);
		expect(resolveSalesPeriodQuery(4, NOW_MS)).toEqual({ from: CURRENT_WEEK_START_MS - 3 * WEEK_MS, to: NOW_MS });
		expect(resolveSalesPeriodQuery(12, NOW_MS)).toEqual({ from: CURRENT_WEEK_START_MS - 11 * WEEK_MS, to: NOW_MS });
	});

	it("produces a query the API accepts for every preset", () => {
		for (const preset of SALES_PERIOD_PRESETS) {
			expect(AdminSalesAnalyticsQuerySchema.safeParse(resolveSalesPeriodQuery(preset.weeks, NOW_MS)).success).toBe(true);
		}
	});
});

describe("salesPeriodLabel", () => {
	it("labels each preset", () => {
		expect(SALES_PERIOD_PRESETS.map((preset) => salesPeriodLabel(preset.weeks))).toEqual(["Last 4 weeks", "Last 8 weeks", "Last 12 weeks"]);
	});
});
