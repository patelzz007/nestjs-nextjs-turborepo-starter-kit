import {
	AnalyticsReportRangeSchema,
	MerchantDashboardPointSchema,
	type AnalyticsComparison,
	type AnalyticsReportRange,
	type DisplayRegion,
	type MerchantDashboardPoint,
} from "@workspace/shared";
import type { TimeSeriesDefinition } from "@workspace/ui/components/time-series-chart";
import { describe, expect, it, vi } from "vitest";

import {
	ANALYTICS_RETRY_LABEL,
	analyticsDisplayRegion,
	analyticsFormatters,
	bucketFormatters,
	formatAnalyticsRangeLabel,
	formatCustomDays,
	formatPreviousPeriodLabel,
	formatShareOfTotal,
	NO_PREVIOUS_PERIOD_LABEL,
	toChartFrameState,
	toChartSeriesData,
	toKpiChange,
	toKpiViews,
} from "./analytics-presentation";

const LOCALE = "en-MY";
const UTC_REGION: DisplayRegion = analyticsDisplayRegion("UTC");
const DAY_MS = 86_400_000;

function comparison(value: number, previous: number, changePercent: number | null): AnalyticsComparison {
	return { value, previous, change: value - previous, changePercent };
}

function spaced(value: string): string {
	return value.replace(/\s/g, " ");
}

describe("analyticsDisplayRegion", () => {
	it("pairs the platform locale with the report's zone", () => {
		expect(analyticsDisplayRegion("Asia/Kuala_Lumpur")).toEqual({ locale: "en-MY", timeZone: "Asia/Kuala_Lumpur" });
	});
});

describe("toKpiChange", () => {
	it("marks a rise as good news for a higher-is-better KPI", () => {
		expect(toKpiChange(comparison(110, 100, 10), "higherIsBetter", LOCALE)).toEqual({ status: "change", direction: "up", sentiment: "positive", label: "+10%" });
	});

	it("marks a fall as bad news for a higher-is-better KPI, and the reverse for lower-is-better", () => {
		expect(toKpiChange(comparison(90, 100, -10), "higherIsBetter", LOCALE)).toEqual({ status: "change", direction: "down", sentiment: "negative", label: "-10%" });
		expect(toKpiChange(comparison(90, 100, -10), "lowerIsBetter", LOCALE)).toEqual({ status: "change", direction: "down", sentiment: "positive", label: "-10%" });
	});

	it("is flat and neutral when nothing changed", () => {
		expect(toKpiChange(comparison(5, 5, 0), "higherIsBetter", LOCALE)).toEqual({ status: "change", direction: "flat", sentiment: "neutral", label: "0%" });
	});

	it("has no percentage when the previous period was empty", () => {
		expect(toKpiChange(comparison(5, 0, null), "higherIsBetter", LOCALE)).toEqual({ status: "noPrevious", label: NO_PREVIOUS_PERIOD_LABEL });
	});
});

describe("formatShareOfTotal", () => {
	it("writes a part's share with one decimal, and 0% of nothing", () => {
		expect(formatShareOfTotal(66, 101, LOCALE)).toBe("65.3%");
		expect(formatShareOfTotal(5, 0, LOCALE)).toBe("0%");
	});
});

describe("range labels", () => {
	it("writes the range with its zone", () => {
		expect(spaced(formatAnalyticsRangeLabel(Date.UTC(2026, 8, 6), Date.UTC(2026, 9, 6), UTC_REGION))).toBe("6 Sept – 5 Oct 2026 · UTC");
	});

	it("names the comparison period", () => {
		const range: AnalyticsReportRange = AnalyticsReportRangeSchema.parse({
			from: Date.UTC(2026, 8, 6),
			to: Date.UTC(2026, 9, 6),
			timeZone: "UTC",
			interval: "day",
			previousFrom: Date.UTC(2026, 7, 7),
			previousTo: Date.UTC(2026, 8, 6),
		});
		expect(spaced(formatPreviousPeriodLabel(range, UTC_REGION))).toBe("vs 7 Aug – 5 Sept 2026");
	});
});

describe("toChartSeriesData", () => {
	const SALES: readonly TimeSeriesDefinition<"salesMinor">[] = [{ key: "salesMinor", label: "Sales", color: "chart-1" }];

	function point(start: number, salesMinor: number, isPartial: boolean): MerchantDashboardPoint {
		return MerchantDashboardPointSchema.parse({ start, end: start + DAY_MS, isPartial, salesMinor, bills: 1, averageBillMinor: salesMinor, claims: 0, redemptions: 0 });
	}

	it("keeps each bucket's bounds and partial flag and reads the series values", () => {
		const data = toChartSeriesData([point(0, 1200, true), point(DAY_MS, 0, false)], SALES);

		expect(data.points.map((chartPoint) => [chartPoint.start, chartPoint.end, chartPoint.isPartial, chartPoint.values.salesMinor])).toEqual([
			[0, DAY_MS, true, 1200],
			[DAY_MS, 2 * DAY_MS, false, 0],
		]);
		expect(data.isEmpty).toBe(false);
	});

	it("is empty when every plotted value is zero", () => {
		expect(toChartSeriesData([point(0, 0, false)], SALES).isEmpty).toBe(true);
		expect(toChartSeriesData([], SALES).isEmpty).toBe(true);
	});
});

describe("bucketFormatters", () => {
	it("writes ticks and full labels for the interval in the report's zone", () => {
		const week = bucketFormatters("week", UTC_REGION);
		const bucket = { start: Date.UTC(2026, 9, 5), end: Date.UTC(2026, 9, 12) };

		expect(week.tick(bucket)).toBe("5 Oct");
		expect(spaced(week.label(bucket))).toBe("5–11 Oct 2026");
	});
});

describe("toChartFrameState", () => {
	it("follows the query: loading, then error with retry, then empty or ready", () => {
		const onRetry = vi.fn<() => void>();

		expect(toChartFrameState({ status: "loading" }, false, "No sales")).toEqual({ status: "loading" });
		expect(toChartFrameState({ status: "error", message: "Boom", onRetry }, false, "No sales")).toEqual({
			status: "error",
			message: "Boom",
			retryLabel: ANALYTICS_RETRY_LABEL,
			onRetry,
		});
		expect(toChartFrameState({ status: "ready" }, true, "No sales")).toEqual({ status: "empty", message: "No sales" });
		expect(toChartFrameState({ status: "ready" }, false, "No sales")).toEqual({ status: "ready" });
	});
});

describe("toKpiViews", () => {
	const formatters = analyticsFormatters("MYR", LOCALE);

	it("formats each KPI by its kind and adds its change", () => {
		const views = toKpiViews(
			[
				{ key: "salesMinor", label: "Sales", format: "money" },
				{ key: "bills", label: "Bills", format: "count" },
				{ key: "conversionRate", label: "Conversion", format: "percent" },
			],
			{ salesMinor: comparison(123_450, 100_000, 23.5), bills: comparison(1200, 0, null), conversionRate: comparison(87.8, 90, -2.4) },
			formatters,
		);

		expect(views.map((view) => [view.label, spaced(view.value ?? "")])).toEqual([
			["Sales", "RM 1,234.50"],
			["Bills", "1,200"],
			["Conversion", "87.8%"],
		]);
		expect(views[1]?.change).toEqual({ status: "noPrevious", label: NO_PREVIOUS_PERIOD_LABEL });
		expect(views[2]?.change).toEqual({ status: "change", direction: "down", sentiment: "negative", label: "-2.4%" });
	});

	it("has no value or change while loading", () => {
		expect(toKpiViews([{ key: "bills", label: "Bills", format: "count" }], undefined, formatters)).toEqual([
			{ key: "bills", label: "Bills", icon: undefined, value: undefined, change: undefined },
		]);
	});
});

describe("analyticsFormatters", () => {
	it("formats money in full and compact, counts and percentages in the locale", () => {
		const formatters = analyticsFormatters("MYR", LOCALE);

		expect(spaced(formatters.money(123_450))).toBe("RM 1,234.50");
		expect(spaced(formatters.moneyCompact(12_345_678))).toBe("RM 123.5K");
		expect(formatters.count(1234)).toBe("1,234");
		expect(formatters.percent(12.5)).toBe("12.5%");
	});
});

describe("formatCustomDays", () => {
	it("writes picked calendar days as they are, whatever the runtime zone", () => {
		expect(spaced(formatCustomDays({ from: "2026-09-01", to: "2026-09-30" }, LOCALE))).toBe("1–30 Sept 2026");
		expect(spaced(formatCustomDays({ from: "2026-09-14", to: "" }, LOCALE))).toBe("14 Sept 2026");
		expect(formatCustomDays({ from: "", to: "" }, LOCALE)).toBe("");
	});
});
