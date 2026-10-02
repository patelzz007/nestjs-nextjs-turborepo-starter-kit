import { describe, expect, it } from "vitest";

import { DEFAULT_SALES_PERIOD_WEEKS, parseSalesPeriodWeeks, resolveSalesPeriodQuery, SALES_PERIOD_PRESETS, salesPeriodLabel, WEEK_MS } from "@/lib/analytics/sales-period";

const NOW_MS = 1_793_059_200_000;

describe("parseSalesPeriodWeeks", () => {
	it("accepts every preset", () => {
		expect(parseSalesPeriodWeeks("4")).toBe(4);
		expect(parseSalesPeriodWeeks("8")).toBe(8);
		expect(parseSalesPeriodWeeks("12")).toBe(12);
	});

	it("falls back to the default when the param is absent", () => {
		expect(parseSalesPeriodWeeks(undefined)).toBe(DEFAULT_SALES_PERIOD_WEEKS);
	});

	it("falls back to the default for a value that is not a preset", () => {
		expect(parseSalesPeriodWeeks("5")).toBe(DEFAULT_SALES_PERIOD_WEEKS);
		expect(parseSalesPeriodWeeks("abc")).toBe(DEFAULT_SALES_PERIOD_WEEKS);
		expect(parseSalesPeriodWeeks("-4")).toBe(DEFAULT_SALES_PERIOD_WEEKS);
	});

	it("falls back to the default when the param is repeated", () => {
		expect(parseSalesPeriodWeeks(["4", "12"])).toBe(DEFAULT_SALES_PERIOD_WEEKS);
	});
});

describe("resolveSalesPeriodQuery", () => {
	it("covers the given number of weeks ending now", () => {
		expect(resolveSalesPeriodQuery(4, NOW_MS)).toEqual({ from: NOW_MS - 4 * WEEK_MS, to: NOW_MS });
		expect(resolveSalesPeriodQuery(12, NOW_MS)).toEqual({ from: NOW_MS - 12 * WEEK_MS, to: NOW_MS });
	});

	it("uses a seven-day week", () => {
		expect(WEEK_MS).toBe(7 * 24 * 60 * 60 * 1000);
	});
});

describe("presets", () => {
	it("defaults to the API's eight-week period", () => {
		expect(DEFAULT_SALES_PERIOD_WEEKS).toBe(8);
	});

	it("labels each preset", () => {
		expect(SALES_PERIOD_PRESETS.map((preset) => preset.label)).toEqual(["Last 4 weeks", "Last 8 weeks", "Last 12 weeks"]);
		expect(salesPeriodLabel(12)).toBe("Last 12 weeks");
	});
});
