// The geometry of the app's charts (src/components/trend-chart.tsx,
// src/components/sparkline.tsx): round y-axis ticks, values to points, and the
// SVG paths drawn through them. Pure and framework-free, so every chart's
// shape is tested without rendering.

/** A point in the plot's own coordinates: x to the right, y down (SVG). */
export interface ChartPoint {
	readonly x: number;
	readonly y: number;
}

/** The plot area, in points. */
export interface PlotSize {
	readonly width: number;
	readonly height: number;
}

/** Steps a "round" tick interval is built from, per power of ten (1, 2, 2.5, 5, 10, 20, …). */
const NICE_STEP_FACTORS: readonly number[] = [1, 2, 2.5, 5, 10];

const DECIMAL_BASE = 10;

/**
 * Evenly spaced, round y-axis ticks from 0 up to at least `max`
 * (`max` 312, 4 intervals → 0, 100, 200, 300, 400). An all-zero series gets
 * the ticks of 1, so the axis never collapses to a single line.
 */
export function niceTicks(max: number, intervals: number): readonly number[] {
	const top = max > 0 ? max : 1;
	const rawStep = top / intervals;
	const magnitude = DECIMAL_BASE ** Math.floor(Math.log10(rawStep));
	const factor = NICE_STEP_FACTORS.find((candidate: number): boolean => candidate * magnitude >= rawStep) ?? DECIMAL_BASE;
	const step = factor * magnitude;
	const count = Math.ceil(top / step);
	return [...Array<number>(count + 1).keys()].map((index: number): number => index * step);
}

/** The highest tick: the value the top of the plot stands for. */
export function scaleTop(ticks: readonly number[]): number {
	return ticks.at(-1) ?? 1;
}

/** The y of `value` on a plot of `height` whose top stands for `top` (0 at the bottom). */
export function yOf(value: number, top: number, height: number): number {
	return height - (value / top) * height;
}

/** The x of the `index`-th of `count` evenly spaced values across `width` (one value sits in the middle). */
export function xOf(index: number, count: number, width: number): number {
	return count <= 1 ? width / 2 : (index / (count - 1)) * width;
}

/** Each value as a point on the plot. */
export function pointsOf(values: readonly number[], top: number, size: PlotSize): readonly ChartPoint[] {
	return values.map((value: number, index: number): ChartPoint => ({ x: xOf(index, values.length, size.width), y: yOf(value, top, size.height) }));
}

/** The value nearest to a touch at `x` (clamped to the plot). */
export function nearestIndex(x: number, count: number, width: number): number {
	if (count <= 1 || width <= 0) {
		return 0;
	}
	const index = Math.round((x / width) * (count - 1));
	return Math.min(count - 1, Math.max(0, index));
}

/** Decimal places kept in a path: sub-pixel enough, and the path stays short. */
const PATH_DECIMALS = 2;

function coordinate(value: number): string {
	return String(Number(value.toFixed(PATH_DECIMALS)));
}

function pair(point: ChartPoint): string {
	return `${coordinate(point.x)} ${coordinate(point.y)}`;
}

/**
 * The tangent at each point of a monotone cubic (Fritsch–Carlson): the curve
 * passes through every point and never overshoots between two of them, so a
 * line never dips below zero or rises above a peak that is not in the data.
 */
function monotoneTangents(points: readonly ChartPoint[]): readonly number[] {
	const slopes = points.slice(1).map((point: ChartPoint, index: number): number => {
		const previous = points.at(index) ?? point;
		const dx = point.x - previous.x;
		return dx === 0 ? 0 : (point.y - previous.y) / dx;
	});
	return points.map((_point: ChartPoint, index: number): number => {
		const before = slopes.at(index - 1);
		const after = slopes.at(index);
		if (index === 0 || before === undefined) {
			return after ?? 0;
		}
		if (index === points.length - 1 || after === undefined) {
			return before;
		}
		// A peak, a trough or a flat stretch: a level tangent keeps the curve from overshooting it.
		return before * after <= 0 ? 0 : (2 * before * after) / (before + after);
	});
}

/** One third: a cubic's control points sit a third of the way along each segment. */
const CONTROL_FRACTION = 1 / 3;

/** A smooth line through `points` that never overshoots them; empty for no points. */
export function linePath(points: readonly ChartPoint[]): string {
	const [first, ...rest] = points;
	if (first === undefined) {
		return "";
	}
	const tangents = monotoneTangents(points);
	const segments = rest.map((point: ChartPoint, offset: number): string => {
		const previous = points.at(offset) ?? first;
		const dx = (point.x - previous.x) * CONTROL_FRACTION;
		const controlStart: ChartPoint = { x: previous.x + dx, y: previous.y + dx * (tangents.at(offset) ?? 0) };
		const controlEnd: ChartPoint = { x: point.x - dx, y: point.y - dx * (tangents.at(offset + 1) ?? 0) };
		return `C ${pair(controlStart)} ${pair(controlEnd)} ${pair(point)}`;
	});
	return [`M ${pair(first)}`, ...segments].join(" ");
}

/** The line closed down to `baselineY`: the wash under a line. Empty for no points. */
export function areaPath(points: readonly ChartPoint[], baselineY: number): string {
	const first = points.at(0);
	const last = points.at(-1);
	if (first === undefined || last === undefined) {
		return "";
	}
	return `${linePath(points)} L ${pair({ x: last.x, y: baselineY })} L ${pair({ x: first.x, y: baselineY })} Z`;
}

// ── Rings (DonutChart, ProgressRing) ───────────────────────────────────────

/** A stretch of a circle, in turns clockwise from 12 o'clock (0.25 is 3 o'clock). */
export interface ArcSpan {
	readonly start: number;
	readonly end: number;
}

const FULL_TURN_RADIANS = 2 * Math.PI;
/** Half a turn: an SVG arc longer than this needs the large-arc flag. */
const HALF_TURN = 0.5;

/** The point `turn` of the way round a circle, clockwise from 12 o'clock. */
export function pointOnCircle(center: ChartPoint, radius: number, turn: number): ChartPoint {
	const radians = turn * FULL_TURN_RADIANS;
	return { x: center.x + radius * Math.sin(radians), y: center.y - radius * Math.cos(radians) };
}

/**
 * An arc of the circle from `span.start` to `span.end`, to be stroked. A whole
 * turn (or more) is drawn as two halves: one SVG arc cannot end where it starts.
 * Empty when the span has no length.
 */
export function arcPath(center: ChartPoint, radius: number, span: ArcSpan): string {
	const length = span.end - span.start;
	if (length <= 0) {
		return "";
	}
	const radiusPair = `${coordinate(radius)} ${coordinate(radius)}`;
	if (length >= 1) {
		const top = pair(pointOnCircle(center, radius, 0));
		const bottom = pair(pointOnCircle(center, radius, HALF_TURN));
		return `M ${top} A ${radiusPair} 0 0 1 ${bottom} A ${radiusPair} 0 0 1 ${top}`;
	}
	const largeArc = length > HALF_TURN ? 1 : 0;
	return `M ${pair(pointOnCircle(center, radius, span.start))} A ${radiusPair} 0 ${String(largeArc)} 1 ${pair(pointOnCircle(center, radius, span.end))}`;
}

/**
 * Where each value sits on a ring of parts: in order, clockwise from 12
 * o'clock, each as long as its share, with `gapTurn` left between neighbours.
 * A zero value has no span (`null`); a lone non-zero value is the whole ring,
 * with no gap to leave.
 */
export function ringSpans(values: readonly number[], gapTurn: number): readonly (ArcSpan | null)[] {
	const total = values.reduce((sum: number, value: number): number => sum + Math.max(0, value), 0);
	const parts = values.filter((value: number): boolean => value > 0).length;
	const gap = parts > 1 ? gapTurn : 0;
	let start = 0;
	return values.map((value: number): ArcSpan | null => {
		if (value <= 0 || total === 0) {
			return null;
		}
		const share = value / total;
		const span: ArcSpan = { start: start + gap / 2, end: Math.max(start + gap / 2, start + share - gap / 2) };
		start += share;
		return span;
	});
}

/** The share of a ring a progress fills: 0 to 1, clamped (over the target is a full ring). */
export function progressShare(value: number, max: number): number {
	if (max <= 0) {
		return 0;
	}
	return Math.min(1, Math.max(0, value / max));
}

// ── Heat (HeatmapGrid) ─────────────────────────────────────────────────────

/**
 * The step of a sequential scale a value falls on: 0 for nothing, then 1 to
 * `levels` in equal slices up to `max`. Any activity is at least step 1, so a
 * quiet cell is never mistaken for an empty one.
 */
export function intensityLevel(value: number, max: number, levels: number): number {
	if (value <= 0 || max <= 0) {
		return 0;
	}
	return Math.min(levels, Math.max(1, Math.ceil((value / max) * levels)));
}
