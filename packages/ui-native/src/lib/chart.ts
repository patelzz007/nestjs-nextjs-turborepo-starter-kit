// The kit charts' geometry, kept pure so it is tested apart from drawing: the value scale's top, where each band
// (a month's column) sits, the paths of lines and areas (straight, smooth or stepped), stacked series, donut
// slices, and points around a circle (radar and radial charts).

/** A point in the chart's drawing, in points from its top left. */
export interface ChartPoint {
	readonly x: number;
	readonly y: number;
}

/** How a line joins its points: straight segments, a smooth curve through them, or a step held until the next. */
export type ChartCurve = "linear" | "natural" | "step";

/** How many gridlines (and so steps) the value scale aims for. */
const NICE_STEPS = 4;
const DECIMAL_BASE = 10;
/** The steps a nice scale rounds to, per power of ten. */
const NICE_FACTORS: readonly number[] = [1, 2, 2.5, 5, 10];

/** The top of a value scale holding `max`, rounded up to a readable step (925 → 1000), and its step. */
export function niceScale(max: number, steps: number = NICE_STEPS): { readonly top: number; readonly step: number } {
	if (max <= 0) {
		return { top: 1, step: 1 / steps };
	}
	const rough = max / steps;
	const magnitude = DECIMAL_BASE ** Math.floor(Math.log10(rough));
	const factor = NICE_FACTORS.find((candidate: number): boolean => candidate * magnitude >= rough) ?? DECIMAL_BASE;
	const step = factor * magnitude;
	return { top: Math.ceil(max / step) * step, step };
}

/** One band of a band scale: where a category's slot starts, and how wide it is. */
export interface ChartBand {
	readonly start: number;
	readonly size: number;
	readonly center: number;
}

/** `count` equal bands across `length`, each with `gapRatio` of its slot left empty around it. */
export function chartBands(count: number, length: number, gapRatio: number): readonly ChartBand[] {
	if (count <= 0) {
		return [];
	}
	const slot = length / count;
	const size = slot * (1 - gapRatio);
	return Array.from({ length: count }, (_, index: number): ChartBand => {
		const start = index * slot + (slot - size) / 2;
		return { start, size, center: start + size / 2 };
	});
}

/** Where each point of a series sits across `width`: the first at the left edge, the last at the right. */
export function chartPointXs(count: number, width: number): readonly number[] {
	if (count <= 1) {
		return [width / 2];
	}
	return Array.from({ length: count }, (_, index: number): number => (index * width) / (count - 1));
}

function formatPoint({ x, y }: ChartPoint): string {
	return `${x.toFixed(2)},${y.toFixed(2)}`;
}

/** The share of the neighbours' span a smooth curve's control points reach (a Catmull-Rom spline). */
const SMOOTHING = 1 / 6;

/** The path commands after the first point, joining `points` by `curve`. */
function joinPoints(points: readonly ChartPoint[], curve: ChartCurve): string {
	const commands: string[] = [];
	points.forEach((point: ChartPoint, index: number): void => {
		if (index === 0) {
			return;
		}
		const previous = points.at(index - 1) ?? point;
		if (curve === "linear") {
			commands.push(`L${formatPoint(point)}`);
		} else if (curve === "step") {
			commands.push(`L${formatPoint({ x: point.x, y: previous.y })}`, `L${formatPoint(point)}`);
		} else {
			const before = points.at(Math.max(index - 2, 0)) ?? previous;
			const after = points.at(Math.min(index + 1, points.length - 1)) ?? point;
			const first = { x: previous.x + (point.x - before.x) * SMOOTHING, y: previous.y + (point.y - before.y) * SMOOTHING };
			const second = { x: point.x - (after.x - previous.x) * SMOOTHING, y: point.y - (after.y - previous.y) * SMOOTHING };
			commands.push(`C${formatPoint(first)} ${formatPoint(second)} ${formatPoint(point)}`);
		}
	});
	return commands.join(" ");
}

/** A line through `points`. */
export function chartLinePath(points: readonly ChartPoint[], curve: ChartCurve): string {
	const [first] = points;
	if (first === undefined) {
		return "";
	}
	return `M${formatPoint(first)} ${joinPoints(points, curve)}`.trim();
}

/** The area between a line through `top` and the line through `bottom` (the baseline, or the series below). */
export function chartAreaPath(top: readonly ChartPoint[], bottom: readonly ChartPoint[], curve: ChartCurve): string {
	const [first] = top;
	const last = bottom.at(-1);
	if (first === undefined || last === undefined) {
		return "";
	}
	const back = [...bottom].reverse();
	return `M${formatPoint(first)} ${joinPoints(top, curve)} L${formatPoint(back.at(0) ?? last)} ${joinPoints(back, curve)} Z`;
}

/** Each series' running total, bottom series first: `[series][point]` gives the top of that series' band. */
export function stackedTotals(series: readonly (readonly number[])[]): readonly (readonly number[])[] {
	const totals: number[][] = [];
	series.forEach((values: readonly number[], index: number): void => {
		const below = totals.at(index - 1);
		totals.push(values.map((value: number, point: number): number => value + (index === 0 ? 0 : (below?.at(point) ?? 0))));
	});
	return totals;
}

/** A bar with its free end rounded (`radius`): the top of a vertical bar, the right end of a horizontal one. */
export function chartBarPath(x: number, y: number, width: number, height: number, radius: number, orientation: "vertical" | "horizontal"): string {
	const r = Math.max(0, Math.min(radius, width / 2, height / 2));
	if (orientation === "vertical") {
		return `M${formatPoint({ x, y: y + height })} L${formatPoint({ x, y: y + r })} Q${formatPoint({ x, y })} ${formatPoint({ x: x + r, y })} L${formatPoint({ x: x + width - r, y })} Q${formatPoint({ x: x + width, y })} ${formatPoint({ x: x + width, y: y + r })} L${formatPoint({ x: x + width, y: y + height })} Z`;
	}
	return `M${formatPoint({ x, y })} L${formatPoint({ x: x + width - r, y })} Q${formatPoint({ x: x + width, y })} ${formatPoint({ x: x + width, y: y + r })} L${formatPoint({ x: x + width, y: y + height - r })} Q${formatPoint({ x: x + width, y: y + height })} ${formatPoint({ x: x + width - r, y: y + height })} L${formatPoint({ x, y: y + height })} Z`;
}

/** A full turn, in radians. */
const TURN = Math.PI * 2;
/** Angles start at twelve o'clock and run clockwise. */
const TWELVE_O_CLOCK = -Math.PI / 2;

/** The point `radius` from the centre at `angle` radians clockwise from twelve o'clock. */
export function polarPoint(cx: number, cy: number, radius: number, angle: number): ChartPoint {
	const theta = TWELVE_O_CLOCK + angle;
	return { x: cx + radius * Math.cos(theta), y: cy + radius * Math.sin(theta) };
}

/** One slice of a pie: its start and end angles (radians, clockwise from twelve o'clock). */
export interface ChartSlice {
	readonly start: number;
	readonly end: number;
}

/** The slices for `values`, each a share of the turn, with `padAngle` radians between neighbours. */
export function pieSlices(values: readonly number[], padAngle: number): readonly ChartSlice[] {
	const total = values.reduce((sum: number, value: number): number => sum + Math.max(0, value), 0);
	if (total === 0) {
		return values.map((): ChartSlice => ({ start: 0, end: 0 }));
	}
	const pad = values.length > 1 ? padAngle : 0;
	const usable = TURN - pad * values.length;
	let cursor = 0;
	return values.map((value: number): ChartSlice => {
		const sweep = (Math.max(0, value) / total) * usable;
		const slice = { start: cursor + pad / 2, end: cursor + pad / 2 + sweep };
		cursor += sweep + pad;
		return slice;
	});
}

/** The share of a turn above which an arc takes SVG's large-arc flag. */
const HALF_TURN = Math.PI;

/** A ring slice from `start` to `end` between `inner` and `outer` radii (a wedge when `inner` is 0). */
export function arcPath(cx: number, cy: number, inner: number, outer: number, start: number, end: number): string {
	const sweep = Math.min(end - start, TURN - Number.EPSILON);
	const finish = start + sweep;
	const large = sweep > HALF_TURN ? 1 : 0;
	const outerStart = polarPoint(cx, cy, outer, start);
	const outerEnd = polarPoint(cx, cy, outer, finish);
	if (inner <= 0) {
		return `M${formatPoint({ x: cx, y: cy })} L${formatPoint(outerStart)} A${String(outer)},${String(outer)} 0 ${String(large)} 1 ${formatPoint(outerEnd)} Z`;
	}
	const innerEnd = polarPoint(cx, cy, inner, finish);
	const innerStart = polarPoint(cx, cy, inner, start);
	return `M${formatPoint(outerStart)} A${String(outer)},${String(outer)} 0 ${String(large)} 1 ${formatPoint(outerEnd)} L${formatPoint(innerEnd)} A${String(inner)},${String(inner)} 0 ${String(large)} 0 ${formatPoint(innerStart)} Z`;
}

/** The corners of a radar's polygon for `values` on a scale to `max`, one per axis, clockwise from the top. */
export function radarPoints(cx: number, cy: number, radius: number, values: readonly number[], max: number): readonly ChartPoint[] {
	const step = TURN / Math.max(values.length, 1);
	return values.map((value: number, index: number): ChartPoint => polarPoint(cx, cy, (Math.max(0, Math.min(value, max)) / max) * radius, step * index));
}

/** A closed polygon through `points`. */
export function polygonPath(points: readonly ChartPoint[]): string {
	return points.length === 0 ? "" : `${chartLinePath(points, "linear")} Z`;
}

/** The angle a value fills on a radial bar scaled to `max` (a full turn at `max`). */
export function radialSweep(value: number, max: number): number {
	return (Math.max(0, Math.min(value, max)) / max) * TURN;
}
