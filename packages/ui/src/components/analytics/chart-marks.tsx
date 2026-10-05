"use client";

import { CHART_SLOT_COLORS, type ChartColorSlot } from "@workspace/ui/lib/charts/chart-colors";
import { CHART_PATTERN_GEOMETRY, CHART_SLOT_ENCODINGS, chartPatternId, type ChartMarkerShape } from "@workspace/ui/lib/charts/chart-encodings";
import * as React from "react";

/** The surface ring around a marker, so it stays legible where it crosses a line. */
const MARKER_RING_PX = 2;
/** Half the side of a square marker relative to the radius (equal visual weight to a circle). */
const SQUARE_HALF_RATIO = 0.85;
const CROSS_STROKE_PX = 2;
/** sqrt(3)/2 — the height factor of an equilateral triangle. */
const TRIANGLE_HEIGHT_RATIO = 0.866;
const DIAMOND_RATIO = 1.2;

export interface ChartMarkerProps {
	readonly shape: ChartMarkerShape;
	readonly cx: number;
	readonly cy: number;
	/** Radius (px); the mark is ≥ 8px across at the default 4. */
	readonly r: number;
	readonly color: string;
}

/** One point marker in its slot's shape — SVG, for plots, legend keys and tooltips. */
export function ChartMarker({ shape, cx, cy, r, color }: ChartMarkerProps): React.JSX.Element {
	const ring = { stroke: "var(--card)", strokeWidth: MARKER_RING_PX };
	switch (shape) {
		case "circle":
			return <circle cx={cx} cy={cy} r={r} fill={color} {...ring} data-marker="circle" />;
		case "square": {
			const half = r * SQUARE_HALF_RATIO;
			return <rect x={cx - half} y={cy - half} width={half * 2} height={half * 2} fill={color} {...ring} data-marker="square" />;
		}
		case "triangle": {
			const height = r * 2 * TRIANGLE_HEIGHT_RATIO;
			return (
				<polygon
					points={`${String(cx)},${String(cy - height / 2 - 1)} ${String(cx + r)},${String(cy + height / 2)} ${String(cx - r)},${String(cy + height / 2)}`}
					fill={color}
					{...ring}
					data-marker="triangle"
				/>
			);
		}
		case "diamond": {
			const d = r * DIAMOND_RATIO;
			return (
				<polygon
					points={`${String(cx)},${String(cy - d)} ${String(cx + d)},${String(cy)} ${String(cx)},${String(cy + d)} ${String(cx - d)},${String(cy)}`}
					fill={color}
					{...ring}
					data-marker="diamond"
				/>
			);
		}
		case "cross":
			return (
				<path
					d={`M${String(cx - r)} ${String(cy - r)}L${String(cx + r)} ${String(cy + r)}M${String(cx + r)} ${String(cy - r)}L${String(cx - r)} ${String(cy + r)}`}
					stroke={color}
					strokeWidth={CROSS_STROKE_PX}
					strokeLinecap="round"
					data-marker="cross"
				/>
			);
	}
}

export interface SeriesKeyProps {
	readonly slot: ChartColorSlot;
	/** `line` = a dashed stroke with the slot's marker; `fill` = a swatch in the slot's pattern. */
	readonly kind: "line" | "fill";
	/** Unique per chart — the SVG pattern ids are scoped by it. */
	readonly scope: string;
}

const KEY_WIDTH_PX = 22;
const KEY_HEIGHT_PX = 12;
const KEY_MARKER_RADIUS_PX = 3.5;

/** A legend / tooltip key that mirrors the mark: dash + marker for a line, the pattern for a fill. Decorative. */
export function SeriesKey({ slot, kind, scope }: SeriesKeyProps): React.JSX.Element {
	const color = CHART_SLOT_COLORS[slot];
	const encoding = CHART_SLOT_ENCODINGS[slot];
	return (
		<svg aria-hidden="true" width={KEY_WIDTH_PX} height={KEY_HEIGHT_PX} className="shrink-0 overflow-visible" data-slot-key={slot}>
			{kind === "line" ? (
				<>
					<line
						x1="0"
						y1={KEY_HEIGHT_PX / 2}
						x2={KEY_WIDTH_PX}
						y2={KEY_HEIGHT_PX / 2}
						stroke={color}
						strokeWidth={2}
						{...(encoding.dash === undefined ? {} : { strokeDasharray: encoding.dash })}
					/>
					<ChartMarker shape={encoding.marker} cx={KEY_WIDTH_PX / 2} cy={KEY_HEIGHT_PX / 2} r={KEY_MARKER_RADIUS_PX} color={color} />
				</>
			) : (
				<>
					<ChartPatternDefs scope={scope} slots={[slot]} />
					<rect x="3" y="0" width={KEY_HEIGHT_PX} height={KEY_HEIGHT_PX} rx="2" fill={chartFill(scope, slot)} />
				</>
			)}
		</svg>
	);
}

/** The SVG fill of `slot`: its colour, or the url of its hatch pattern. */
export function chartFill(scope: string, slot: ChartColorSlot): string {
	return CHART_SLOT_ENCODINGS[slot].pattern === "solid" ? CHART_SLOT_COLORS[slot] : `url(#${chartPatternId(scope, slot)})`;
}

export interface ChartPatternDefsProps {
	readonly scope: string;
	readonly slots: readonly ChartColorSlot[];
}

/** `<defs>` with the hatch pattern of every patterned slot in `slots` (solid slots need none). */
export function ChartPatternDefs({ scope, slots }: ChartPatternDefsProps): React.JSX.Element {
	const { hatchLinePx, hatchPeriodPx, dotRadiusPx, dotPeriodPx } = CHART_PATTERN_GEOMETRY;
	return (
		<defs>
			{slots.map((slot) => {
				const color = CHART_SLOT_COLORS[slot];
				const id = chartPatternId(scope, slot);
				switch (CHART_SLOT_ENCODINGS[slot].pattern) {
					case "solid":
						return null;
					case "diagonal":
					case "antiDiagonal":
						return (
							<pattern
								key={slot}
								id={id}
								patternUnits="userSpaceOnUse"
								width={hatchPeriodPx}
								height={hatchPeriodPx}
								patternTransform={`rotate(${CHART_SLOT_ENCODINGS[slot].pattern === "diagonal" ? "45" : "135"})`}
								data-pattern={CHART_SLOT_ENCODINGS[slot].pattern}>
								<rect width={hatchPeriodPx} height={hatchPeriodPx} fill={color} />
								<rect width={hatchLinePx} height={hatchPeriodPx} fill="var(--card)" />
							</pattern>
						);
					case "crosshatch":
						return (
							<pattern key={slot} id={id} patternUnits="userSpaceOnUse" width={hatchPeriodPx} height={hatchPeriodPx} patternTransform="rotate(45)" data-pattern="crosshatch">
								<rect width={hatchPeriodPx} height={hatchPeriodPx} fill={color} />
								<rect width={hatchLinePx} height={hatchPeriodPx} fill="var(--card)" />
								<rect width={hatchPeriodPx} height={hatchLinePx} fill="var(--card)" />
							</pattern>
						);
					case "dots":
						return (
							<pattern key={slot} id={id} patternUnits="userSpaceOnUse" width={dotPeriodPx} height={dotPeriodPx} data-pattern="dots">
								<rect width={dotPeriodPx} height={dotPeriodPx} fill={color} />
								<circle cx={dotPeriodPx / 2} cy={dotPeriodPx / 2} r={dotRadiusPx} fill="var(--card)" />
							</pattern>
						);
				}
			})}
		</defs>
	);
}
