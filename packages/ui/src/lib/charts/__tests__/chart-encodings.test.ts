import { describe, expect, it } from "vitest";

import { CHART_COLOR_SLOTS } from "./chart-colors";
import { CHART_SLOT_ENCODINGS, chartPatternId, type ChartFillPattern, chartPatternStyle, MIN_RANK_OPACITY, rankOpacity } from "./chart-encodings";

function distinct(values: readonly (string | undefined)[]): number {
	return new Set(values).size;
}

describe("CHART_SLOT_ENCODINGS", () => {
	const encodings = CHART_COLOR_SLOTS.map((slot) => CHART_SLOT_ENCODINGS[slot]);

	it("gives every slot its own dash, marker and fill pattern", () => {
		expect(distinct(encodings.map((encoding) => encoding.dash))).toBe(CHART_COLOR_SLOTS.length);
		expect(distinct(encodings.map((encoding) => encoding.marker))).toBe(CHART_COLOR_SLOTS.length);
		expect(distinct(encodings.map((encoding) => encoding.pattern))).toBe(CHART_COLOR_SLOTS.length);
	});

	it("keeps the primary series plain: solid line, circle, solid fill", () => {
		expect(CHART_SLOT_ENCODINGS["chart-1"]).toEqual({ dash: undefined, marker: "circle", pattern: "solid" });
	});
});

describe("chartPatternStyle", () => {
	it("adds no texture to a solid fill and a distinct one to every other pattern", () => {
		expect(chartPatternStyle("solid")).toEqual({});
		const patterns: readonly ChartFillPattern[] = ["diagonal", "antiDiagonal", "crosshatch", "dots"];
		const textures = patterns.map((pattern) => JSON.stringify(chartPatternStyle(pattern)));
		expect(distinct(textures)).toBe(textures.length);
		expect(chartPatternStyle("diagonal").backgroundImage).toContain("45deg");
		expect(chartPatternStyle("antiDiagonal").backgroundImage).toContain("135deg");
	});
});

describe("chartPatternId", () => {
	it("is unique per chart and slot", () => {
		expect(chartPatternId("c1", "chart-2")).toBe("c1-pattern-chart-2");
		expect(chartPatternId("c1", "chart-2")).not.toBe(chartPatternId("c2", "chart-2"));
	});
});

describe("rankOpacity", () => {
	it("steps from full strength for the first rank down to the floor for the last", () => {
		expect(rankOpacity(0, 5)).toBe(1);
		expect(rankOpacity(4, 5)).toBeCloseTo(MIN_RANK_OPACITY);
		expect(rankOpacity(1, 5)).toBeGreaterThan(rankOpacity(2, 5));
	});

	it("is full strength for a single row and never below the floor", () => {
		expect(rankOpacity(0, 1)).toBe(1);
		expect(rankOpacity(9, 5)).toBeCloseTo(MIN_RANK_OPACITY);
	});
});
