import { cleanup, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CHART_LOADING, type ChartFrameState } from "./analytics-panel";
import { SeriesTooltip, TimeSeriesChart, type TimeSeriesChartLabels, type TimeSeriesDefinition, type TimeSeriesPoint } from "./time-series-chart";

type Key = "claims" | "redemptions";

const DAY_MS = 86_400_000;
const LABELS: TimeSeriesChartLabels = {
	partial: "Partial period",
	partialNote: "Shaded periods are partial.",
	showTable: "Show as table",
	period: "Period",
};
const SERIES: readonly TimeSeriesDefinition<Key>[] = [
	{ key: "claims", label: "Claims", color: "chart-1" },
	{ key: "redemptions", label: "Redemptions", color: "chart-2" },
];
const START = Date.UTC(2026, 9, 1);
const POINTS: readonly TimeSeriesPoint<Key>[] = [
	{ start: START, end: START + DAY_MS, isPartial: false, values: { claims: 1200, redemptions: 800 } },
	{ start: START + DAY_MS, end: START + 2 * DAY_MS, isPartial: true, values: { claims: 3, redemptions: 0 } },
];

function formatValue(value: number): string {
	return `#${String(value)}`;
}
function formatTick(point: TimeSeriesPoint<Key>): string {
	return `tick-${String(point.start)}`;
}
function formatLabel(point: TimeSeriesPoint<Key>): string {
	return `day ${new Date(point.start).toISOString().slice(0, 10)}`;
}

function renderChart(overrides: Partial<React.ComponentProps<typeof TimeSeriesChart<Key>>> = {}): void {
	render(
		<TimeSeriesChart
			title="Claims and redemptions"
			points={POINTS}
			series={SERIES}
			kind="line"
			formatValue={formatValue}
			formatAxisValue={formatValue}
			formatBucketTick={formatTick}
			formatBucketLabel={formatLabel}
			labels={LABELS}
			{...overrides}
		/>,
	);
}

beforeEach((): void => {
	// jsdom has no matchMedia; the chart reads prefers-reduced-motion through it.
	vi.stubGlobal("matchMedia", (query: string): Pick<MediaQueryList, "matches" | "media" | "addEventListener" | "removeEventListener"> => ({
		matches: true,
		media: query,
		addEventListener: (): void => undefined,
		removeEventListener: (): void => undefined,
	}));
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("TimeSeriesChart", () => {
	it("is a figure named by its title", (): void => {
		renderChart();

		expect(screen.getByRole("figure", { name: "Claims and redemptions" })).toBeTruthy();
	});

	it("shows a legend for two or more series and none for one", (): void => {
		renderChart();
		expect(screen.getAllByText("Claims").length).toBeGreaterThan(0);
		cleanup();

		renderChart({ series: [SERIES[0] ?? { key: "claims", label: "Claims", color: "chart-1" }] });
		expect(screen.queryByRole("list")).toBeNull();
	});

	it("keys each series with its slot's dash and marker in a line legend, and its pattern in a bar legend", (): void => {
		const { container } = render(
			<TimeSeriesChart
				title="Lines"
				points={POINTS}
				series={SERIES}
				kind="line"
				formatValue={formatValue}
				formatAxisValue={formatValue}
				formatBucketTick={formatTick}
				formatBucketLabel={formatLabel}
				labels={LABELS}
			/>,
		);
		const legendKeys = [...container.querySelectorAll("ul [data-slot-key]")];
		expect(legendKeys.map((key) => key.querySelector("line")?.getAttribute("stroke-dasharray") ?? "solid")).toEqual(["solid", "6 4"]);
		expect(legendKeys.map((key) => key.querySelector("[data-marker]")?.getAttribute("data-marker"))).toEqual(["circle", "square"]);
		cleanup();

		const bars = render(
			<TimeSeriesChart
				title="Bars"
				points={POINTS}
				series={SERIES}
				kind="stackedBar"
				formatValue={formatValue}
				formatAxisValue={formatValue}
				formatBucketTick={formatTick}
				formatBucketLabel={formatLabel}
				labels={LABELS}
			/>,
		);
		const fills = [...bars.container.querySelectorAll("ul [data-slot-key] > rect")].map((rect) => rect.getAttribute("fill") ?? "");
		expect(fills[0]).toBe("var(--chart-1)");
		expect(fills[1]).toMatch(/^url\(#.+-legend-pattern-chart-2\)$/);
	});

	it("puts every value in a table, formatted, with partial buckets marked", (): void => {
		renderChart();

		const table = screen.getByRole("table", { name: "Claims and redemptions" });
		const rows = within(table).getAllByRole("row");
		expect(rows.map((row) => row.textContent)).toEqual(["PeriodClaimsRedemptions", "day 2026-10-01#1200#800", "day 2026-10-02(Partial period)#3#0"]);
		expect(screen.getByText("Show as table")).toBeTruthy();
	});

	it("explains the shading only when a bucket is partial", (): void => {
		renderChart();
		expect(screen.getByText("Shaded periods are partial.")).toBeTruthy();
		cleanup();

		renderChart({ points: POINTS.filter((point) => !point.isPartial) });
		expect(screen.queryByText("Shaded periods are partial.")).toBeNull();
	});

	const NOT_READY: readonly [string, ChartFrameState][] = [
		["loading", CHART_LOADING],
		["empty", { status: "empty", message: "Nothing in this range" }],
	];

	it.each(NOT_READY)("replaces the plot and the table in the %s state", (_name: string, state: ChartFrameState): void => {
		renderChart({ state });

		expect(screen.queryByRole("table")).toBeNull();
	});

	it("forwards its ref to the figure", (): void => {
		const ref = React.createRef<HTMLElement>();
		renderChart({ ref });

		expect(ref.current).toBe(screen.getByRole("figure", { name: "Claims and redemptions" }));
	});
});

describe("SeriesTooltip", () => {
	it("lists every series at the bucket, value first, and names a partial bucket", (): void => {
		const point = POINTS[1];
		if (point === undefined) throw new Error("fixture missing");
		render(<SeriesTooltip point={point} series={SERIES} formatValue={formatValue} bucketLabel="2 Oct 2026" partialLabel="Partial period" />);

		expect(screen.getByText("2 Oct 2026").textContent).toBe("2 Oct 2026(Partial period)");
		expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["#3Claims", "#0Redemptions"]);
	});
});
