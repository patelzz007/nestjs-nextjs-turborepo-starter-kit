// ============================================
// lib/charts/chart-colors.ts - the chart series colour slots
// ============================================
// Charts never pick a colour: each series names a SLOT (`chart-1` … `chart-5`)
// and the app theme fills the slot (`--chart-N` in packages/tokens semantic.ts,
// overridden per app in `apps/*/app/*-theme.css`, light and dark). The order is
// fixed and assigned in sequence — never cycled — so slot 1 is always the first
// series and an entity keeps its slot when filters change the series count
// (docs/technical/frontend/analytics-charts.md, the colour rules).
//
// Slots 1–4 are the categorical hues, validated for colour-vision deficiency
// as adjacent pairs; slot 5 is the low-chroma de-emphasis gray ("Other", the
// context series behind an emphasised one).

/** One chart colour slot. */
export type ChartColorSlot = "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5";

/** Every slot, in assignment order. */
export const CHART_COLOR_SLOTS: readonly [ChartColorSlot, ChartColorSlot, ChartColorSlot, ChartColorSlot, ChartColorSlot] = [
	"chart-1",
	"chart-2",
	"chart-3",
	"chart-4",
	"chart-5",
];

/** The categorical slots — distinct hues for series identity. */
export const CATEGORICAL_CHART_SLOTS: readonly [ChartColorSlot, ChartColorSlot, ChartColorSlot, ChartColorSlot] = ["chart-1", "chart-2", "chart-3", "chart-4"];

/** The de-emphasis slot: "Other" and context series. */
export const DEEMPHASIS_CHART_SLOT: ChartColorSlot = "chart-5";

/** The CSS value of a slot for SVG `fill` / `stroke` and inline styles. */
export const CHART_SLOT_COLORS: Readonly<Record<ChartColorSlot, string>> = {
	"chart-1": "var(--chart-1)",
	"chart-2": "var(--chart-2)",
	"chart-3": "var(--chart-3)",
	"chart-4": "var(--chart-4)",
	"chart-5": "var(--chart-5)",
};

/** Tailwind background class of a slot (literal strings so the build generates them). */
export const CHART_SLOT_BACKGROUNDS: Readonly<Record<ChartColorSlot, string>> = {
	"chart-1": "bg-chart-1",
	"chart-2": "bg-chart-2",
	"chart-3": "bg-chart-3",
	"chart-4": "bg-chart-4",
	"chart-5": "bg-chart-5",
};

/**
 * The categorical slot of the `index`-th entity (0-based), in fixed order.
 * Past the categorical slots every entity takes the de-emphasis slot — a fifth
 * series is never a generated hue; fold it into "Other" instead.
 */
export function categoricalChartSlot(index: number): ChartColorSlot {
	return CATEGORICAL_CHART_SLOTS[index] ?? DEEMPHASIS_CHART_SLOT;
}
