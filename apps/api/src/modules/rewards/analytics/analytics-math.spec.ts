import { describe, expect, it } from "vitest";

import { changePercent, compare, conversionRate, seriesFor } from "./analytics-math";

describe("changePercent", () => {
	it("is the relative change in percent, one decimal", () => {
		expect(changePercent(150, 100)).toBe(50);
		expect(changePercent(50, 100)).toBe(-50);
		expect(changePercent(1, 3)).toBe(-66.7);
		expect(changePercent(100, 100)).toBe(0);
	});

	it("is null without a base (previous = 0), whatever the new value", () => {
		expect(changePercent(5, 0)).toBeNull();
		expect(changePercent(0, 0)).toBeNull();
	});
});

describe("compare", () => {
	it("returns the value, the base, the absolute and the relative change", () => {
		expect(compare(120, 100)).toEqual({ value: 120, previous: 100, change: 20, changePercent: 20 });
		expect(compare(0, 40)).toEqual({ value: 0, previous: 40, change: -40, changePercent: -100 });
		expect(compare(7, 0)).toEqual({ value: 7, previous: 0, change: 7, changePercent: null });
	});

	it("keeps a percentage-point change free of floating-point noise", () => {
		expect(compare(62.5, 70.1).change).toBe(-7.6);
	});
});

describe("conversionRate", () => {
	it("is redemptions ÷ claims in percent, one decimal, and 0 without claims", () => {
		expect(conversionRate(3, 1)).toBe(33.3);
		expect(conversionRate(4, 4)).toBe(100);
		expect(conversionRate(0, 0)).toBe(0);
	});
});

describe("seriesFor", () => {
	it("gives every bucket a value, zero where there is none", () => {
		expect(seriesFor([10, 20, 30], new Map([[20, 500]]))).toEqual([
			{ start: 10, totalMinor: 0 },
			{ start: 20, totalMinor: 500 },
			{ start: 30, totalMinor: 0 },
		]);
	});
});
