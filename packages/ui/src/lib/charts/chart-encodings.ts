// ============================================
// lib/charts/chart-encodings.ts - the non-colour identity of each chart slot
// ============================================
// Colour alone never identifies a series: in a monochrome theme (the admin
// panel's neutral ramp) two grays sit close, and for a colour-blind reader or a
// grayscale print any two hues may too. Every slot therefore also owns
//   - a stroke dash pattern and a point marker shape (lines, areas, legends),
//   - a fill pattern (bars, stacked segments, share bars, legend swatches),
// fixed per slot like its colour, so a series keeps all three wherever it is
// drawn. Slot 1 — the primary series — is the plain one (solid line, circle,
// solid fill); the others add a distinct texture.

import type { CSSProperties } from "react";

import type { ChartColorSlot } from "./chart-colors";

/** A point marker drawn on a line at each bucket (and in its legend key). */
export type ChartMarkerShape = "circle" | "square" | "triangle" | "diamond" | "cross";

/** A bar fill: solid, or the slot colour hatched with surface-coloured lines. */
export type ChartFillPattern = "solid" | "diagonal" | "antiDiagonal" | "crosshatch" | "dots";

export interface ChartSlotEncoding {
	/** SVG `stroke-dasharray`; `undefined` = solid. */
	readonly dash: string | undefined;
	readonly marker: ChartMarkerShape;
	readonly pattern: ChartFillPattern;
}

export const CHART_SLOT_ENCODINGS: Readonly<Record<ChartColorSlot, ChartSlotEncoding>> = {
	"chart-1": { dash: undefined, marker: "circle", pattern: "solid" },
	"chart-2": { dash: "6 4", marker: "square", pattern: "diagonal" },
	"chart-3": { dash: "2 3", marker: "triangle", pattern: "antiDiagonal" },
	"chart-4": { dash: "8 3 2 3", marker: "diamond", pattern: "crosshatch" },
	"chart-5": { dash: "1 5", marker: "cross", pattern: "dots" },
};

/** Hatch line width and period (px): fine enough to read as texture, wide enough to survive print. */
const HATCH_LINE_PX = 1.5;
const HATCH_PERIOD_PX = 5;
const DOT_RADIUS_PX = 1;
const DOT_PERIOD_PX = 4;
/** Anti-aliasing edge of a hatch dot. */
const DOT_EDGE_PX = 0.5;

/** The surface the hatch lines are drawn in — the card the chart sits on. */
const SURFACE = "var(--card)";

function stripes(angleDeg: number): string {
	return `repeating-linear-gradient(${String(angleDeg)}deg, transparent 0 ${String(HATCH_PERIOD_PX - HATCH_LINE_PX)}px, ${SURFACE} ${String(HATCH_PERIOD_PX - HATCH_LINE_PX)}px ${String(HATCH_PERIOD_PX)}px)`;
}

const DIAGONAL_DEG = 45;
const ANTI_DIAGONAL_DEG = 135;

/**
 * CSS for an HTML swatch or bar segment in `pattern` (layered over the slot's
 * background colour) — the same textures `ChartPatternDefs` draws in SVG.
 */
export function chartPatternStyle(pattern: ChartFillPattern): CSSProperties {
	switch (pattern) {
		case "solid":
			return {};
		case "diagonal":
			return { backgroundImage: stripes(DIAGONAL_DEG) };
		case "antiDiagonal":
			return { backgroundImage: stripes(ANTI_DIAGONAL_DEG) };
		case "crosshatch":
			return { backgroundImage: `${stripes(DIAGONAL_DEG)}, ${stripes(ANTI_DIAGONAL_DEG)}` };
		case "dots":
			return {
				backgroundImage: `radial-gradient(${SURFACE} ${String(DOT_RADIUS_PX)}px, transparent ${String(DOT_RADIUS_PX + DOT_EDGE_PX)}px)`,
				backgroundSize: `${String(DOT_PERIOD_PX)}px ${String(DOT_PERIOD_PX)}px`,
			};
	}
}

/** Geometry shared by the SVG patterns. */
export const CHART_PATTERN_GEOMETRY: Readonly<{ hatchLinePx: number; hatchPeriodPx: number; dotRadiusPx: number; dotPeriodPx: number }> = {
	hatchLinePx: HATCH_LINE_PX,
	hatchPeriodPx: HATCH_PERIOD_PX,
	dotRadiusPx: DOT_RADIUS_PX,
	dotPeriodPx: DOT_PERIOD_PX,
};

/** The SVG `<pattern>` id of `slot` inside one chart (`scope` keeps two charts' defs apart). */
export function chartPatternId(scope: string, slot: ChartColorSlot): string {
	return `${scope}-pattern-${slot}`;
}

/**
 * Ordered lightness for a RANKED list of one series: the bar of rank `index`
 * (0 = first) at a decreasing opacity of the slot colour, never below
 * {@link MIN_RANK_OPACITY} so the last bar still clears the track.
 */
export function rankOpacity(index: number, count: number): number {
	if (count <= 1) {
		return 1;
	}
	const opacity = 1 - ((1 - MIN_RANK_OPACITY) * Math.min(index, count - 1)) / (count - 1);
	return Math.round(opacity * OPACITY_PRECISION) / OPACITY_PRECISION;
}

/** Opacities are kept to two decimals (stable CSS, no floating-point noise). */
const OPACITY_PRECISION = 100;

/** The faintest ranked bar (the slot colour at this opacity keeps ≥ 2:1 on the track). */
export const MIN_RANK_OPACITY = 0.45;
