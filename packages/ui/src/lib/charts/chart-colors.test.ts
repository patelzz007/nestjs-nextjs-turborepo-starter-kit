import { describe, expect, it } from "vitest";

import { CATEGORICAL_CHART_SLOTS, CHART_COLOR_SLOTS, CHART_SLOT_BACKGROUNDS, CHART_SLOT_COLORS, categoricalChartSlot, DEEMPHASIS_CHART_SLOT } from "./chart-colors";

describe("chart colour slots", () => {
	it("maps every slot to its theme variable and Tailwind class", () => {
		for (const slot of CHART_COLOR_SLOTS) {
			expect(CHART_SLOT_COLORS[slot]).toBe(`var(--${slot})`);
			expect(CHART_SLOT_BACKGROUNDS[slot]).toBe(`bg-${slot}`);
		}
	});

	it("assigns categorical slots in fixed order", () => {
		expect([0, 1, 2, 3].map(categoricalChartSlot)).toEqual([...CATEGORICAL_CHART_SLOTS]);
	});

	it("never generates a fifth hue — later entities take the de-emphasis slot", () => {
		expect(categoricalChartSlot(4)).toBe(DEEMPHASIS_CHART_SLOT);
		expect(categoricalChartSlot(9)).toBe(DEEMPHASIS_CHART_SLOT);
	});
});
