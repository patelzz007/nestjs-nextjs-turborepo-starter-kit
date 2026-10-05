import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CHART_COLOR_SLOTS, CHART_SLOT_COLORS } from "../../lib/charts/chart-colors";
import { CHART_SLOT_ENCODINGS, type ChartMarkerShape } from "../../lib/charts/chart-encodings";
import { chartFill, ChartMarker, ChartPatternDefs, SeriesKey } from "./chart-marks";

afterEach((): void => {
	cleanup();
});

const SHAPES: readonly ChartMarkerShape[] = ["circle", "square", "triangle", "diamond", "cross"];

describe("ChartMarker", () => {
	it.each(SHAPES)("draws a %s", (shape: ChartMarkerShape): void => {
		const { container } = render(
			<svg>
				<ChartMarker shape={shape} cx={10} cy={10} r={4} color="var(--chart-1)" />
			</svg>,
		);

		expect(container.querySelector(`[data-marker="${shape}"]`)).not.toBeNull();
	});
});

describe("SeriesKey", () => {
	it("gives every slot's line key its own dash and marker", (): void => {
		const { container } = render(
			<>
				{CHART_COLOR_SLOTS.map((slot) => (
					<SeriesKey key={slot} slot={slot} kind="line" scope="legend" />
				))}
			</>,
		);

		const keys = CHART_COLOR_SLOTS.map((slot) => container.querySelector(`[data-slot-key="${slot}"]`));
		expect(new Set(keys.map((key) => key?.querySelector("line")?.getAttribute("stroke-dasharray") ?? "solid")).size).toBe(CHART_COLOR_SLOTS.length);
		expect(new Set(keys.map((key) => key?.querySelector("[data-marker]")?.getAttribute("data-marker"))).size).toBe(CHART_COLOR_SLOTS.length);
	});

	it("fills a bar key with the slot's pattern", (): void => {
		const { container } = render(<SeriesKey slot="chart-2" kind="fill" scope="legend" />);

		expect(container.querySelector("svg > rect")?.getAttribute("fill")).toBe("url(#legend-pattern-chart-2)");
		expect(container.querySelector('pattern[data-pattern="diagonal"]')?.id).toBe("legend-pattern-chart-2");
	});
});

describe("chartFill / ChartPatternDefs", () => {
	it("fills slot 1 solid and every other slot with its own pattern", (): void => {
		expect(chartFill("c", "chart-1")).toBe(CHART_SLOT_COLORS["chart-1"]);
		const { container } = render(
			<svg>
				<ChartPatternDefs scope="c" slots={CHART_COLOR_SLOTS} />
			</svg>,
		);

		const patterns = [...container.querySelectorAll("pattern")].map((pattern) => pattern.getAttribute("data-pattern"));
		expect(patterns).toEqual(CHART_COLOR_SLOTS.filter((slot) => slot !== "chart-1").map((slot) => CHART_SLOT_ENCODINGS[slot].pattern));
	});
});
