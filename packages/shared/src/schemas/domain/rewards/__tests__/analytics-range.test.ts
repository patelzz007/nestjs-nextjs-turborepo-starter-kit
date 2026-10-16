import { describe, expect, it } from "vitest";

import { DAY_MS } from "./analytics";
import { MerchantAnalyticsDashboardQuerySchema } from "./analytics-dashboard";
import {
	DAILY_INTERVAL_MAX_DAYS,
	DEFAULT_ANALYTICS_RANGE_DAYS,
	defaultAnalyticsInterval,
	MAX_ANALYTICS_RANGE_DAYS,
	previousAnalyticsRange,
	resolveAnalyticsRange,
	WEEKLY_INTERVAL_MAX_DAYS,
} from "./analytics-range";

const NOW = Date.UTC(2026, 9, 5, 12);

describe("defaultAnalyticsInterval", () => {
	it("is daily up to a month, weekly up to half a year, monthly beyond", () => {
		expect(defaultAnalyticsInterval(0, DAILY_INTERVAL_MAX_DAYS * DAY_MS)).toBe("day");
		expect(defaultAnalyticsInterval(0, DAILY_INTERVAL_MAX_DAYS * DAY_MS + 1)).toBe("week");
		expect(defaultAnalyticsInterval(0, WEEKLY_INTERVAL_MAX_DAYS * DAY_MS)).toBe("week");
		expect(defaultAnalyticsInterval(0, WEEKLY_INTERVAL_MAX_DAYS * DAY_MS + 1)).toBe("month");
	});
});

describe("resolveAnalyticsRange", () => {
	it("defaults to the last 30 days ending now, with the interval its length implies", () => {
		expect(resolveAnalyticsRange({}, NOW)).toEqual({ fromMs: NOW - DEFAULT_ANALYTICS_RANGE_DAYS * DAY_MS, toMs: NOW, interval: "day" });
	});

	it("keeps an explicit range exactly (no re-alignment) and an explicit interval", () => {
		expect(resolveAnalyticsRange({ from: 1_000, to: 2_000, interval: "month" }, NOW)).toEqual({ fromMs: 1_000, toMs: 2_000, interval: "month" });
		expect(resolveAnalyticsRange({ to: NOW - DAY_MS }, NOW)).toEqual({ fromMs: NOW - 31 * DAY_MS, toMs: NOW - DAY_MS, interval: "day" });
	});
});

describe("previousAnalyticsRange", () => {
	it("is the equally long range right before", () => {
		expect(previousAnalyticsRange({ fromMs: 100, toMs: 160 })).toEqual({ fromMs: 40, toMs: 100 });
	});
});

describe("range validation (every dashboard and export query)", () => {
	const to = NOW;

	it(`accepts up to ${String(MAX_ANALYTICS_RANGE_DAYS)} days and refuses one day more, naming the limit`, () => {
		expect(MerchantAnalyticsDashboardQuerySchema.safeParse({ from: to - MAX_ANALYTICS_RANGE_DAYS * DAY_MS, to }).success).toBe(true);
		const tooLong = MerchantAnalyticsDashboardQuerySchema.safeParse({ from: to - (MAX_ANALYTICS_RANGE_DAYS + 1) * DAY_MS, to });
		expect(tooLong.success).toBe(false);
		expect(tooLong.error?.issues.map((issue) => issue.message).join()).toContain(String(MAX_ANALYTICS_RANGE_DAYS));
	});

	it("refuses from ≥ to", () => {
		expect(MerchantAnalyticsDashboardQuerySchema.safeParse({ from: to, to }).success).toBe(false);
		expect(MerchantAnalyticsDashboardQuerySchema.safeParse({ from: to + 1, to }).success).toBe(false);
	});

	it("refuses an unknown interval and an unknown key", () => {
		expect(MerchantAnalyticsDashboardQuerySchema.safeParse({ interval: "year" }).success).toBe(false);
		expect(MerchantAnalyticsDashboardQuerySchema.safeParse({ granularity: "day" }).success).toBe(false);
	});
});
