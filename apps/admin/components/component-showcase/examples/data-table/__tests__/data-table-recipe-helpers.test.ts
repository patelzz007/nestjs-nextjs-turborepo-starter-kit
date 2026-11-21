import { describe, expect, it } from "vitest";

import {
	extentOf,
	HEAT_SCALE_CLASSES,
	heatClassFor,
	normalizeToScale,
	percentChange,
	sparklinePoints,
	trendOf,
} from "@/components/component-showcase/examples/data-table/data-table-recipe-helpers";

describe("normalizeToScale", () => {
	it("places a value between the ends, clamped to 0..1", () => {
		expect(normalizeToScale(5, 0, 10)).toBe(0.5);
		expect(normalizeToScale(-5, 0, 10)).toBe(0);
		expect(normalizeToScale(15, 0, 10)).toBe(1);
	});

	it("puts every value in the middle when the ends are the same", () => {
		expect(normalizeToScale(3, 3, 3)).toBe(0.5);
	});
});

describe("extentOf", () => {
	it("finds the smallest and largest, and is 0..0 for nothing", () => {
		expect(extentOf([4, -1, 9])).toEqual({ min: -1, max: 9 });
		expect(extentOf([])).toEqual({ min: 0, max: 0 });
	});
});

describe("heatClassFor", () => {
	it("gives the palest step at 0 and the strongest at 1", () => {
		expect(heatClassFor(0)).toBe(HEAT_SCALE_CLASSES.at(0));
		expect(heatClassFor(1)).toBe(HEAT_SCALE_CLASSES.at(-1));
		expect(heatClassFor(0.5)).toBe(HEAT_SCALE_CLASSES.at(3));
	});
});

describe("trendOf and percentChange", () => {
	it("reads a move up, down or flat, within a tolerance", () => {
		expect(trendOf(10, 12)).toBe("up");
		expect(trendOf(10, 8)).toBe("down");
		expect(trendOf(10, 10.4, 0.5)).toBe("flat");
	});

	it("works a change out as a percentage, and has none from zero", () => {
		expect(percentChange(200, 250)).toBe(25);
		expect(percentChange(-100, -50)).toBe(50);
		expect(percentChange(0, 5)).toBeNull();
	});
});

describe("sparklinePoints", () => {
	it("draws the highest value at the top and spreads points across the width", () => {
		expect(sparklinePoints([0, 10, 5], 100, 20)).toBe("0,20 50,0 100,10");
	});

	it("draws one point at the left, and nothing for no values", () => {
		expect(sparklinePoints([7], 100, 20)).toBe("0,10");
		expect(sparklinePoints([], 100, 20)).toBe("");
	});
});
