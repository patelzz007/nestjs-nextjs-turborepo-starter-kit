// The chart palette: the design tokens' `chart-1…5` (the web's chart slots), as
// the token utilities each kind of mark needs. Uniwind compiles only class
// names written out in full, so every slot spells out its classes here.
//
// A series keeps its slot whatever else is on screen (colour follows the
// entity, never its rank), and labels never wear it: text stays in the text
// tokens, a swatch beside it carries the identity. `chart-5` is each theme's
// neutral slot: "Other", a previous period, anything stepped back from.

/** One categorical slot, in the order series are given them. */
export type ChartColor = "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5";

/** A sequential scale of one hue, faint to full: the steps of a heatmap. */
export type ChartRamp = readonly [string, string, string, string];

export interface ChartColorClasses {
	/** Filled shapes made of views: bars, swatches, the parts of a share bar. */
	readonly fill: string;
	/** A fill stepped back from: the bars not picked while one is. */
	readonly faded: string;
	/** SVG marks (lines, dots, arcs) through `colorClassName`. */
	readonly accent: string;
	/** The hue light to full, for magnitude (`ramp` steps 1–4; nothing is `bg-muted`). */
	readonly ramp: ChartRamp;
}

export const CHART_COLOR_CLASSES: Readonly<Record<ChartColor, ChartColorClasses>> = {
	"chart-1": { fill: "bg-chart-1", faded: "bg-chart-1/35", accent: "accent-chart-1", ramp: ["bg-chart-1/20", "bg-chart-1/45", "bg-chart-1/70", "bg-chart-1"] },
	"chart-2": { fill: "bg-chart-2", faded: "bg-chart-2/35", accent: "accent-chart-2", ramp: ["bg-chart-2/20", "bg-chart-2/45", "bg-chart-2/70", "bg-chart-2"] },
	"chart-3": { fill: "bg-chart-3", faded: "bg-chart-3/35", accent: "accent-chart-3", ramp: ["bg-chart-3/20", "bg-chart-3/45", "bg-chart-3/70", "bg-chart-3"] },
	"chart-4": { fill: "bg-chart-4", faded: "bg-chart-4/35", accent: "accent-chart-4", ramp: ["bg-chart-4/20", "bg-chart-4/45", "bg-chart-4/70", "bg-chart-4"] },
	"chart-5": { fill: "bg-chart-5", faded: "bg-chart-5/35", accent: "accent-chart-5", ramp: ["bg-chart-5/20", "bg-chart-5/45", "bg-chart-5/70", "bg-chart-5"] },
};

/** Steps in every ramp. */
export const CHART_RAMP_STEPS = 4;

/** The class of a ramp step (0 is "nothing": the muted surface). */
export function rampClassOf(color: ChartColor, level: number): string {
	return level <= 0 ? "bg-muted" : (CHART_COLOR_CLASSES[color].ramp.at(Math.min(level, CHART_RAMP_STEPS) - 1) ?? CHART_COLOR_CLASSES[color].fill);
}
