"use client";

import { CHART_SLOT_COLORS, type ChartColorSlot } from "@workspace/ui/lib/charts/chart-colors";
import { CHART_PATTERN_GEOMETRY, CHART_SLOT_ENCODINGS, chartPatternId, type ChartMarkerShape } from "@workspace/ui/lib/charts/chart-encodings";
import * as React from "react";

/** The surface every mark is cut out of — the card the chart sits on. */
const SURFACE_COLOR = "var(--card)";
/** The surface ring around a marker, so it stays legible where it crosses a line. */
const MARKER_RING_PX = 2;
/** Shared ring attributes — one object for every marker, never rebuilt per render. */
const MARKER_RING: Readonly<{ stroke: string; strokeWidth: number }> = { stroke: SURFACE_COLOR, strokeWidth: MARKER_RING_PX };
/** Half the side of a square marker relative to the radius (equal visual weight to a circle). */
const SQUARE_HALF_RATIO = 0.85;
const CROSS_STROKE_PX = 2;
/** sqrt(3)/2 — the height factor of an equilateral triangle. */
const TRIANGLE_HEIGHT_RATIO = 0.866;
/** Optical lift of the triangle's apex, so it sits centred on the point like the other shapes. */
const TRIANGLE_APEX_LIFT_PX = 1;
const DIAMOND_RATIO = 1.2;
/** Hatch angles of the two diagonal patterns (degrees). */
const DIAGONAL_HATCH_DEG = 45;
const ANTI_DIAGONAL_HATCH_DEG = 135;

/**
 * Each shape is a different SVG element type, so the forwarded ref is exposed
 * through `useImperativeHandle` as their common base, `SVGGeometryElement`; the
 * returned callback (accepted by every shape) records the mounted node.
 */
function useGeometryRef(ref: React.ForwardedRef<SVGGeometryElement>): React.RefCallback<SVGGeometryElement> {
	const nodeRef = React.useRef<SVGGeometryElement | null>(null);
	React.useImperativeHandle<SVGGeometryElement | null, SVGGeometryElement | null>(ref, (): SVGGeometryElement | null => nodeRef.current, []);
	return React.useCallback((node: SVGGeometryElement | null): void => {
		nodeRef.current = node;
	}, []);
}

export interface ChartMarkerProps {
	readonly shape: ChartMarkerShape;
	readonly cx: number;
	readonly cy: number;
	/** Radius (px); the mark is ≥ 8px across at the default 4. */
	readonly r: number;
	readonly color: string;
}

/**
 * One point marker in its slot's shape — SVG, for plots, legend keys and tooltips.
 * Memoised: a line chart draws one per bucket per series, and every prop is a primitive.
 */
export const ChartMarker = React.memo(
	React.forwardRef<SVGGeometryElement, ChartMarkerProps>(function ChartMarker({ shape, cx, cy, r, color }, ref): React.JSX.Element {
		const setRef = useGeometryRef(ref);
		switch (shape) {
			case "circle":
				return <circle ref={setRef} cx={cx} cy={cy} r={r} fill={color} {...MARKER_RING} data-marker="circle" />;
			case "square": {
				const half = r * SQUARE_HALF_RATIO;
				return <rect ref={setRef} x={cx - half} y={cy - half} width={half * 2} height={half * 2} fill={color} {...MARKER_RING} data-marker="square" />;
			}
			case "triangle": {
				const height = r * 2 * TRIANGLE_HEIGHT_RATIO;
				return (
					<polygon
						ref={setRef}
						points={`${String(cx)},${String(cy - height / 2 - TRIANGLE_APEX_LIFT_PX)} ${String(cx + r)},${String(cy + height / 2)} ${String(cx - r)},${String(cy + height / 2)}`}
						fill={color}
						{...MARKER_RING}
						data-marker="triangle"
					/>
				);
			}
			case "diamond": {
				const d = r * DIAMOND_RATIO;
				return (
					<polygon
						ref={setRef}
						points={`${String(cx)},${String(cy - d)} ${String(cx + d)},${String(cy)} ${String(cx)},${String(cy + d)} ${String(cx - d)},${String(cy)}`}
						fill={color}
						{...MARKER_RING}
						data-marker="diamond"
					/>
				);
			}
			case "cross":
				return (
					<path
						ref={setRef}
						d={`M${String(cx - r)} ${String(cy - r)}L${String(cx + r)} ${String(cy + r)}M${String(cx + r)} ${String(cy - r)}L${String(cx - r)} ${String(cy + r)}`}
						stroke={color}
						strokeWidth={CROSS_STROKE_PX}
						strokeLinecap="round"
						data-marker="cross"
					/>
				);
		}
	}),
);

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
const KEY_LINE_WIDTH_PX = 2;
/** The fill swatch's left inset and corner radius inside the key. */
const KEY_SWATCH_INSET_PX = 3;
const KEY_SWATCH_RADIUS_PX = 2;

/** A legend / tooltip key that mirrors the mark: dash + marker for a line, the pattern for a fill. Decorative. */
export const SeriesKey = React.forwardRef<SVGSVGElement, SeriesKeyProps>(function SeriesKey({ slot, kind, scope }, ref): React.JSX.Element {
	const color = CHART_SLOT_COLORS[slot];
	const encoding = CHART_SLOT_ENCODINGS[slot];
	const slots = React.useMemo((): readonly ChartColorSlot[] => [slot], [slot]);
	return (
		<svg ref={ref} aria-hidden="true" width={KEY_WIDTH_PX} height={KEY_HEIGHT_PX} className="shrink-0 overflow-visible" data-slot-key={slot}>
			{kind === "line" ? (
				<>
					<line
						x1="0"
						y1={KEY_HEIGHT_PX / 2}
						x2={KEY_WIDTH_PX}
						y2={KEY_HEIGHT_PX / 2}
						stroke={color}
						strokeWidth={KEY_LINE_WIDTH_PX}
						{...(encoding.dash === undefined ? {} : { strokeDasharray: encoding.dash })}
					/>
					<ChartMarker shape={encoding.marker} cx={KEY_WIDTH_PX / 2} cy={KEY_HEIGHT_PX / 2} r={KEY_MARKER_RADIUS_PX} color={color} />
				</>
			) : (
				<>
					<ChartPatternDefs scope={scope} slots={slots} />
					<rect x={KEY_SWATCH_INSET_PX} y="0" width={KEY_HEIGHT_PX} height={KEY_HEIGHT_PX} rx={KEY_SWATCH_RADIUS_PX} fill={chartFill(scope, slot)} />
				</>
			)}
		</svg>
	);
});

/** The SVG fill of `slot`: its colour, or the url of its hatch pattern. */
export function chartFill(scope: string, slot: ChartColorSlot): string {
	return CHART_SLOT_ENCODINGS[slot].pattern === "solid" ? CHART_SLOT_COLORS[slot] : `url(#${chartPatternId(scope, slot)})`;
}

export interface ChartPatternDefsProps {
	readonly scope: string;
	readonly slots: readonly ChartColorSlot[];
}

/** `<defs>` with the hatch pattern of every patterned slot in `slots` (solid slots need none). */
export const ChartPatternDefs = React.forwardRef<SVGDefsElement, ChartPatternDefsProps>(function ChartPatternDefs({ scope, slots }, ref): React.JSX.Element {
	const { hatchLinePx, hatchPeriodPx, dotRadiusPx, dotPeriodPx } = CHART_PATTERN_GEOMETRY;
	return (
		<defs ref={ref}>
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
								patternTransform={`rotate(${String(CHART_SLOT_ENCODINGS[slot].pattern === "diagonal" ? DIAGONAL_HATCH_DEG : ANTI_DIAGONAL_HATCH_DEG)})`}
								data-pattern={CHART_SLOT_ENCODINGS[slot].pattern}>
								<rect width={hatchPeriodPx} height={hatchPeriodPx} fill={color} />
								<rect width={hatchLinePx} height={hatchPeriodPx} fill={SURFACE_COLOR} />
							</pattern>
						);
					case "crosshatch":
						return (
							<pattern
								key={slot}
								id={id}
								patternUnits="userSpaceOnUse"
								width={hatchPeriodPx}
								height={hatchPeriodPx}
								patternTransform={`rotate(${String(DIAGONAL_HATCH_DEG)})`}
								data-pattern="crosshatch">
								<rect width={hatchPeriodPx} height={hatchPeriodPx} fill={color} />
								<rect width={hatchLinePx} height={hatchPeriodPx} fill={SURFACE_COLOR} />
								<rect width={hatchPeriodPx} height={hatchLinePx} fill={SURFACE_COLOR} />
							</pattern>
						);
					case "dots":
						return (
							<pattern key={slot} id={id} patternUnits="userSpaceOnUse" width={dotPeriodPx} height={dotPeriodPx} data-pattern="dots">
								<rect width={dotPeriodPx} height={dotPeriodPx} fill={color} />
								<circle cx={dotPeriodPx / 2} cy={dotPeriodPx / 2} r={dotRadiusPx} fill={SURFACE_COLOR} />
							</pattern>
						);
				}
			})}
		</defs>
	);
});
