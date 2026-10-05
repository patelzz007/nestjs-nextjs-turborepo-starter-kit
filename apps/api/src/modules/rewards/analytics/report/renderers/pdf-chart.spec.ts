import { describe, expect, it } from "vitest";

import type { AnalyticsReportChart } from "../analytics-report";
import { CHART_MAX_X_LABELS, drawChart, labelledIndices, niceAxis, type ChartCanvas, type ChartStyle } from "./pdf-chart";

/** Records every drawing call, so a test can assert on what the chart drew. */
class RecordingCanvas implements ChartCanvas {
	public readonly calls: string[] = [];
	public readonly texts: string[] = [];

	public moveTo(x: number, y: number): void {
		this.calls.push(`moveTo ${x.toFixed(1)} ${y.toFixed(1)}`);
	}
	public lineTo(x: number, y: number): void {
		this.calls.push(`lineTo ${x.toFixed(1)} ${y.toFixed(1)}`);
	}
	public rect(x: number, y: number, width: number, height: number): void {
		this.calls.push(`rect ${x.toFixed(1)} ${y.toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)}`);
	}
	public circle(): void {
		this.calls.push("circle");
	}
	public stroke(): void {
		this.calls.push("stroke");
	}
	public fill(): void {
		this.calls.push("fill");
	}
	public lineWidth(): void {
		this.calls.push("lineWidth");
	}
	public strokeColor(color: string): void {
		this.calls.push(`strokeColor ${color}`);
	}
	public fillColor(color: string): void {
		this.calls.push(`fillColor ${color}`);
	}
	public fontSize(): void {
		this.calls.push("fontSize");
	}
	public text(text: string): void {
		this.texts.push(text);
	}
}

const STYLE: ChartStyle = {
	formatValue: (value: number): string => String(value),
	labelOf: (start: number): string => `b${String(start)}`,
	palette: ["#111111", "#222222"],
	axisColor: "#999999",
	gridColor: "#eeeeee",
	textColor: "#000000",
};
const AREA = { x: 0, y: 0, width: 400, height: 200 };

function chartOf(kind: AnalyticsReportChart["kind"], series: readonly (readonly number[])[]): AnalyticsReportChart {
	return {
		title: "Chart",
		kind,
		unit: "count",
		series: series.map((values, index) => ({ label: `S${String(index)}`, points: values.map((value, bucket) => ({ start: bucket, value })) })),
	};
}

describe("niceAxis", () => {
	it("rounds the top of the axis up to 1, 2, 2.5 or 5 × 10^n steps", () => {
		expect(niceAxis(8)).toEqual({ max: 8, step: 2, ticks: 4 });
		expect(niceAxis(123_450)).toEqual({ max: 200_000, step: 50_000, ticks: 4 });
		expect(niceAxis(10)).toEqual({ max: 10, step: 2.5, ticks: 4 });
		expect(niceAxis(4)).toEqual({ max: 4, step: 1, ticks: 4 });
	});

	it("gives an empty series a 0 … ticks axis instead of dividing by zero", () => {
		expect(niceAxis(0)).toEqual({ max: 4, step: 1, ticks: 4 });
	});
});

describe("labelledIndices", () => {
	it("labels every bucket while they fit, then evenly spaced ones (always the first)", () => {
		expect(labelledIndices(5)).toEqual([0, 1, 2, 3, 4]);
		expect(labelledIndices(20)).toEqual([0, 3, 6, 9, 12, 15, 18]);
		expect(labelledIndices(367).length).toBeLessThanOrEqual(CHART_MAX_X_LABELS);
		expect(labelledIndices(0)).toEqual([]);
	});
});

describe("drawChart", () => {
	it("draws one filled bar per bucket, from the axis up to the value", () => {
		const canvas = new RecordingCanvas();
		drawChart(canvas, AREA, chartOf("bar", [[2, 8]]), STYLE);

		const bars = canvas.calls.filter((call) => call.startsWith("rect"));
		expect(bars).toHaveLength(2);
		// 8 is the top of the axis: the second bar is the full plot height, the first a quarter of it.
		const heights = bars.map((bar) => Number(bar.split(" ")[4]));
		expect(heights[1]).toBeCloseTo((heights[0] ?? 0) * 4, 5);
		expect(canvas.texts).toContain("Chart");
		expect(canvas.texts).toEqual(expect.arrayContaining(["b0", "b1", "0", "8"]));
	});

	it("draws each line series as one path in its palette colour, with a legend", () => {
		const canvas = new RecordingCanvas();
		drawChart(
			canvas,
			AREA,
			chartOf("line", [
				[1, 2, 3],
				[3, 2, 1],
			]),
			STYLE,
		);

		expect(canvas.calls.filter((call) => call.startsWith("lineTo")).length).toBeGreaterThanOrEqual(2 * 2);
		expect(canvas.calls).toContain("strokeColor #111111");
		expect(canvas.calls).toContain("strokeColor #222222");
		expect(canvas.texts).toEqual(expect.arrayContaining(["S0", "S1"]));
	});
});
