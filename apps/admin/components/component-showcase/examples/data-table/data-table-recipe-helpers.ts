// Small pure helpers the DataTable recipes share. They belong to the recipes (the smart layer), not to the table: the
// table only draws what the recipes hand it.

/** Where a value sits between `min` and `max`, from 0 to 1; the middle (0.5) when every value is the same. */
export function normalizeToScale(value: number, min: number, max: number): number {
	if (max === min) {
		return HALF;
	}
	return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

const HALF = 0.5;

/** The smallest and largest of some numbers, or `{ min: 0, max: 0 }` for none. */
export function extentOf(values: readonly number[]): { readonly min: number; readonly max: number } {
	return values.length === 0 ? { min: 0, max: 0 } : { min: Math.min(...values), max: Math.max(...values) };
}

/**
 * The steps of a heat scale, palest first. Token classes only: each step is the primary colour at a stronger mix, so
 * the scale follows the theme in light and dark mode.
 */
export const HEAT_SCALE_CLASSES: readonly string[] = [
	"bg-primary/5",
	"bg-primary/15",
	"bg-primary/30",
	"bg-primary/45",
	"bg-primary/60 text-primary-foreground",
	"bg-primary/80 text-primary-foreground",
];

/** The heat-scale class for a value placed on a 0..1 scale. */
export function heatClassFor(scaled: number): string {
	const index = Math.min(HEAT_SCALE_CLASSES.length - 1, Math.floor(scaled * HEAT_SCALE_CLASSES.length));
	return HEAT_SCALE_CLASSES.at(index) ?? "";
}

/** How a number moved from one period to the next. */
export type Trend = "up" | "down" | "flat";

/** The direction from `previous` to `current`, treating a change smaller than `tolerance` as flat. */
export function trendOf(previous: number, current: number, tolerance = 0): Trend {
	if (Math.abs(current - previous) <= tolerance) {
		return "flat";
	}
	return current > previous ? "up" : "down";
}

/** A change as a percentage of where it started, or `null` when it started at zero. */
export function percentChange(previous: number, current: number): number | null {
	return previous === 0 ? null : ((current - previous) / Math.abs(previous)) * PERCENT;
}

const PERCENT = 100;

/**
 * The `points` attribute of an SVG polyline drawing `values` across a `width` × `height` box, highest value at the
 * top. An empty list draws nothing.
 */
export function sparklinePoints(values: readonly number[], width: number, height: number): string {
	if (values.length === 0) {
		return "";
	}
	const { min, max } = extentOf(values);
	const step = values.length === 1 ? 0 : width / (values.length - 1);
	return values
		.map(
			(value, index) =>
				`${String(Math.round(index * step * ROUNDING) / ROUNDING)},${String(Math.round((1 - normalizeToScale(value, min, max)) * height * ROUNDING) / ROUNDING)}`,
		)
		.join(" ");
}

/** Points are written to one decimal place: enough for a few pixels, short enough to read in the DOM. */
const ROUNDING = 10;
