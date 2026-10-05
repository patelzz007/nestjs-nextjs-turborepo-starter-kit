// ============================================
// pdf-chart.ts — a small vector chart drawer for the PDF export
// ============================================
// Draws a bar or line chart of an `AnalyticsReportChart` with plain path
// operations (move / line / rect / text), so the chart stays sharp at any zoom
// and the PDF needs no image. It talks to a narrow `ChartCanvas` (the slice of
// PDFKit it uses — Interface Segregation), which a test can record.

import type { AnalyticsReportChart } from "../analytics-report";

/** The drawing operations a chart needs. PDFKit's `PDFDocument` satisfies it. */
export interface ChartCanvas {
	moveTo(x: number, y: number): void;
	lineTo(x: number, y: number): void;
	rect(x: number, y: number, width: number, height: number): void;
	circle(x: number, y: number, radius: number): void;
	stroke(): void;
	fill(): void;
	lineWidth(width: number): void;
	strokeColor(color: string): void;
	fillColor(color: string): void;
	fontSize(size: number): void;
	text(text: string, x: number, y: number, options: ChartTextOptions): void;
}

export interface ChartTextOptions {
	readonly width: number;
	readonly align: "left" | "center" | "right";
	readonly lineBreak: boolean;
}

/** Where on the page the chart goes (points, origin top-left). */
export interface ChartArea {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/** How values and bucket starts read on the axes, and the series colours. */
export interface ChartStyle {
	readonly formatValue: (value: number) => string;
	readonly labelOf: (start: number) => string;
	/** One colour per series, in order (cycled). */
	readonly palette: readonly string[];
	readonly axisColor: string;
	readonly gridColor: string;
	readonly textColor: string;
}

/** A value axis from 0 to `max`, in `ticks` steps of `step`. */
export interface NiceAxis {
	readonly max: number;
	readonly step: number;
	readonly ticks: number;
}

/** Steps a "nice" axis may take, per power of ten (1, 2, 2.5, 5, 10 × 10^n). */
const NICE_STEP_MULTIPLIERS: readonly number[] = [1, 2, 2.5, 5, 10];
const DECIMAL_BASE = 10;

/** Gridlines (value-axis steps) drawn above zero. */
export const CHART_VALUE_TICKS = 4;

/** At most this many bucket labels under the x axis — the rest are skipped so labels never overlap. */
export const CHART_MAX_X_LABELS = 8;

/** Share of a bucket's slot a bar fills (the rest is the gap between bars). */
const BAR_FILL_RATIO = 0.7;

/** Points per series above which line markers are left out (they would merge into a smear). */
const MAX_MARKED_POINTS = 40;

/** Layout constants (points). */
const AXIS_LABEL_WIDTH = 52;
const AXIS_LABEL_GAP = 4;
const TITLE_HEIGHT = 16;
const LEGEND_HEIGHT = 14;
const X_LABEL_HEIGHT = 14;
const LABEL_FONT_SIZE = 7;
const TITLE_FONT_SIZE = 10;
const TEXT_BASELINE_OFFSET = 3;
const LINE_WIDTH = 1.5;
const GRID_LINE_WIDTH = 0.5;
const MARKER_RADIUS = 1.8;
const LEGEND_SWATCH_SIZE = 7;
const LEGEND_ENTRY_WIDTH = 90;

/**
 * The smallest "nice" axis (0 … max in `ticks` equal steps of 1, 2, 2.5 or 5 × 10^n)
 * that holds `maxValue`. An all-zero series gets a 0 … `ticks` axis.
 */
export function niceAxis(maxValue: number, ticks: number = CHART_VALUE_TICKS): NiceAxis {
	if (maxValue <= 0) {
		return { max: ticks, step: 1, ticks };
	}
	const rawStep = maxValue / ticks;
	const magnitude = DECIMAL_BASE ** Math.floor(Math.log10(rawStep));
	const multiplier = NICE_STEP_MULTIPLIERS.find((candidate) => candidate * magnitude >= rawStep) ?? DECIMAL_BASE;
	const step = multiplier * magnitude;
	return { max: step * ticks, step, ticks };
}

/** Indices of the buckets that get an x-axis label: evenly spaced, at most {@link CHART_MAX_X_LABELS}, always the first. */
export function labelledIndices(count: number, maxLabels: number = CHART_MAX_X_LABELS): number[] {
	const every = Math.max(1, Math.ceil(count / maxLabels));
	return Array.from({ length: count }, (_unused, index) => index).filter((index) => index % every === 0);
}

/** Draws `chart` into `area`: title, legend (for several series), gridlines with value labels, bars or lines, bucket labels. */
export function drawChart(canvas: ChartCanvas, area: ChartArea, chart: AnalyticsReportChart, style: ChartStyle): void {
	const pointCount = Math.max(0, ...chart.series.map((series) => series.points.length));
	const maxValue = Math.max(0, ...chart.series.flatMap((series) => series.points.map((point) => point.value)));
	const axis = niceAxis(maxValue);
	const hasLegend = chart.series.length > 1;

	canvas.fillColor(style.textColor);
	canvas.fontSize(TITLE_FONT_SIZE);
	canvas.text(chart.title, area.x, area.y, { width: area.width, align: "left", lineBreak: false });

	const plot: ChartArea = {
		x: area.x + AXIS_LABEL_WIDTH,
		y: area.y + TITLE_HEIGHT + (hasLegend ? LEGEND_HEIGHT : 0),
		width: area.width - AXIS_LABEL_WIDTH,
		height: area.height - TITLE_HEIGHT - (hasLegend ? LEGEND_HEIGHT : 0) - X_LABEL_HEIGHT,
	};
	const yOf = (value: number): number => plot.y + plot.height - (value / axis.max) * plot.height;
	const slot = pointCount === 0 ? plot.width : plot.width / pointCount;
	const centerOf = (index: number): number => plot.x + slot * index + slot / 2;

	if (hasLegend) {
		drawLegend(canvas, area, chart, style);
	}

	// Gridlines + value labels.
	canvas.fontSize(LABEL_FONT_SIZE);
	canvas.lineWidth(GRID_LINE_WIDTH);
	for (let tick = 0; tick <= axis.ticks; tick += 1) {
		const value = tick * axis.step;
		const y = yOf(value);
		canvas.strokeColor(tick === 0 ? style.axisColor : style.gridColor);
		canvas.moveTo(plot.x, y);
		canvas.lineTo(plot.x + plot.width, y);
		canvas.stroke();
		canvas.fillColor(style.textColor);
		canvas.text(style.formatValue(value), area.x, y - TEXT_BASELINE_OFFSET, { width: AXIS_LABEL_WIDTH - AXIS_LABEL_GAP, align: "right", lineBreak: false });
	}

	chart.series.forEach((series, seriesIndex) => {
		const color = style.palette[seriesIndex % style.palette.length] ?? style.axisColor;
		if (chart.kind === "bar") {
			const barWidth = (slot * BAR_FILL_RATIO) / chart.series.length;
			canvas.fillColor(color);
			series.points.forEach((point, index) => {
				const barX = centerOf(index) - (slot * BAR_FILL_RATIO) / 2 + barWidth * seriesIndex;
				const top = yOf(point.value);
				canvas.rect(barX, top, barWidth, plot.y + plot.height - top);
				canvas.fill();
			});
			return;
		}
		canvas.strokeColor(color);
		canvas.lineWidth(LINE_WIDTH);
		series.points.forEach((point, index) => {
			if (index === 0) {
				canvas.moveTo(centerOf(index), yOf(point.value));
			} else {
				canvas.lineTo(centerOf(index), yOf(point.value));
			}
		});
		canvas.stroke();
		if (series.points.length <= MAX_MARKED_POINTS) {
			canvas.fillColor(color);
			series.points.forEach((point, index) => {
				canvas.circle(centerOf(index), yOf(point.value), MARKER_RADIUS);
				canvas.fill();
			});
		}
	});

	// Bucket labels under the x axis.
	const firstSeries = chart.series.at(0);
	canvas.fillColor(style.textColor);
	canvas.fontSize(LABEL_FONT_SIZE);
	const labelWidth = Math.max(slot, plot.width / CHART_MAX_X_LABELS);
	for (const index of labelledIndices(pointCount)) {
		const point = firstSeries?.points[index];
		if (point !== undefined) {
			canvas.text(style.labelOf(point.start), centerOf(index) - labelWidth / 2, plot.y + plot.height + TEXT_BASELINE_OFFSET, {
				width: labelWidth,
				align: "center",
				lineBreak: false,
			});
		}
	}
}

function drawLegend(canvas: ChartCanvas, area: ChartArea, chart: AnalyticsReportChart, style: ChartStyle): void {
	canvas.fontSize(LABEL_FONT_SIZE);
	chart.series.forEach((series, index) => {
		const x = area.x + AXIS_LABEL_WIDTH + index * LEGEND_ENTRY_WIDTH;
		const y = area.y + TITLE_HEIGHT;
		canvas.fillColor(style.palette[index % style.palette.length] ?? style.axisColor);
		canvas.rect(x, y, LEGEND_SWATCH_SIZE, LEGEND_SWATCH_SIZE);
		canvas.fill();
		canvas.fillColor(style.textColor);
		canvas.text(series.label, x + LEGEND_SWATCH_SIZE + AXIS_LABEL_GAP, y, {
			width: LEGEND_ENTRY_WIDTH - LEGEND_SWATCH_SIZE - AXIS_LABEL_GAP,
			align: "left",
			lineBreak: false,
		});
	});
}
