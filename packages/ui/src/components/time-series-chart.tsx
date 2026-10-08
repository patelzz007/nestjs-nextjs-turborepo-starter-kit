"use client";

import { isNumberPrimitive } from "@workspace/shared";
import { ChartStateFrame, CHART_READY, type ChartFrameState } from "@workspace/ui/components/analytics-panel";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@workspace/ui/components/chart";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { ChartMarker, ChartPatternDefs, chartFill, SeriesKey } from "@workspace/ui/components/chart-marks";
import { CHART_SLOT_COLORS, type ChartColorSlot } from "@workspace/ui/lib/charts/chart-colors";
import { CHART_SLOT_ENCODINGS, type ChartMarkerShape } from "@workspace/ui/lib/charts/chart-encodings";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { useMediaQuery } from "@workspace/ui/hooks/use-media-query";
import * as React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ReferenceArea, XAxis, YAxis, type TooltipContentProps } from "recharts";

/** One bucket of a time series: `[start, end)` plus one value per series key. */
export interface TimeSeriesPoint<TKey extends string> {
	readonly start: number;
	readonly end: number;
	/** The bucket was clipped by the range — its total covers fewer days. */
	readonly isPartial: boolean;
	readonly values: Readonly<Record<TKey, number>>;
}

/** One plotted series: which value it reads, its legend name and its colour slot. */
export interface TimeSeriesDefinition<TKey extends string> {
	readonly key: TKey;
	readonly label: string;
	readonly color: ChartColorSlot;
}

/** The mark: a line or area for a trend, bars for per-bucket amounts, stacked bars for parts of a per-bucket whole. */
export type TimeSeriesKind = "line" | "area" | "bar" | "stackedBar";

/** The words the chart needs — the `timeSeriesChart` family of `UiKitLabels`, never hardcoded here. */
export interface TimeSeriesChartLabels {
	/** Marks a partial bucket in the tooltip and the table, e.g. "Partial period". */
	readonly partial: string;
	/** Explains the shaded buckets under the chart, e.g. "Shaded periods are partial…". */
	readonly partialNote: string;
	/** The summary of the data-table disclosure, e.g. "Show as table". */
	readonly showTable: string;
	/** Header of the period column, e.g. "Period". */
	readonly period: string;
}

export interface TimeSeriesChartProps<TKey extends string> extends Omit<React.HTMLAttributes<HTMLElement>, "children" | "title"> {
	/** Forwarded to the `<figure>` (React 19 ref-as-prop, so the component stays generic). */
	readonly ref?: React.Ref<HTMLElement>;
	/** Accessible name of the figure and caption of its table, e.g. "Sales over time". */
	readonly title: string;
	readonly points: readonly TimeSeriesPoint<TKey>[];
	readonly series: readonly TimeSeriesDefinition<TKey>[];
	readonly kind: TimeSeriesKind;
	/** A value in full ("RM 1,234.50") — tooltip and table. */
	readonly formatValue: (value: number) => string;
	/** A value on the y-axis ("RM 1.2K"). */
	readonly formatAxisValue: (value: number) => string;
	/** A bucket on the x-axis ("5 Oct"). */
	readonly formatBucketTick: (point: TimeSeriesPoint<TKey>) => string;
	/** A bucket in full ("5 – 11 Oct 2026") — tooltip and table. */
	readonly formatBucketLabel: (point: TimeSeriesPoint<TKey>) => string;
	/** Per-usage overrides of the `timeSeriesChart` copy from `UiKitLabelsProvider`. */
	readonly labels?: UiKitLabelsOverride<"timeSeriesChart"> | undefined;
	/** Loading / empty / error replace the plot; defaults to `ready`. */
	readonly state?: ChartFrameState;
	/** Width (px) reserved for y-axis ticks. */
	readonly axisWidth?: number;
}

/** Thickest a bar may get — it never fills its slot; the leftover band is air. */
const MAX_BAR_THICKNESS_PX = 24;
/** Rounded data end; the baseline end stays square. */
const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];
const FLAT_RADIUS: [number, number, number, number] = [0, 0, 0, 0];
/** Line and area stroke width. */
const LINE_WIDTH_PX = 2;
/** The surface gap between touching marks (stacked segments). */
const SURFACE_GAP_PX = 2;
/** Gap between grouped bars of one bucket. */
const GROUPED_BAR_GAP_PX = 2;
/** Area fill: a wash of the series hue, never a saturated block. */
const AREA_FILL_OPACITY = 0.1;
/** Active (hovered / focused) point marker radius — ≥ 8px across. */
const ACTIVE_DOT_RADIUS_PX = 4;
/** Point markers (r = 3 → 6px + ring) are drawn while the series is short enough for them to stay apart. */
const MAX_MARKED_POINTS = 40;
const MARKER_RADIUS_PX = 3;
const ACTIVE_MARKER_RADIUS_PX = ACTIVE_DOT_RADIUS_PX;
/** Room on the right of a multi-line chart for the direct series labels at the line ends. */
const DIRECT_LABEL_GUTTER_PX = 96;
const DIRECT_LABEL_OFFSET_PX = 6;
/** Longest direct label before it is shortened with an ellipsis (the legend keeps the full name). */
const DIRECT_LABEL_MAX_CHARS = 14;
const DEFAULT_AXIS_WIDTH_PX = 56;
const TICK_MARGIN_PX = 8;
/** Direct line-end labels: a step below the chart's `text-xs` axis ticks, so they never compete with them. */
const DIRECT_LABEL_FONT_SIZE_PX = 11;
/** Shortest gap between two x-axis ticks before recharts drops one. */
const MIN_TICK_GAP_PX = 16;
/** Horizontal grid lines sit behind the data, softer than the border token. */
const GRID_STROKE_OPACITY = 0.7;
/** Shade of a partial bucket. */
const PARTIAL_FILL_OPACITY = 0.6;
/** The hovered bucket's band behind bars. */
const BAR_CURSOR_FILL_OPACITY = 0.5;
/** The surface the marks are cut out of — the card the chart sits on. */
const SURFACE_COLOR = "var(--card)";
const STACK_ID = "stack";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// Recharts props that are objects — module constants, so a re-render never hands recharts a new identity.
const LINE_CURSOR: Readonly<{ stroke: string }> = { stroke: "var(--border)" };
const BAR_CURSOR: Readonly<{ fill: string; fillOpacity: number }> = { fill: "var(--muted)", fillOpacity: BAR_CURSOR_FILL_OPACITY };
const DIRECT_LABEL_MARGIN: Readonly<{ right: number }> = { right: DIRECT_LABEL_GUTTER_PX };

interface BarShapeProps {
	readonly stackId?: string;
	readonly stroke?: string;
	readonly strokeWidth?: number;
	readonly radius: [number, number, number, number];
}

/** A grouped bar: rounded at its data end. */
const GROUPED_BAR: BarShapeProps = { radius: BAR_RADIUS };
/** A stacked segment: square, cut from its neighbours by a surface gap. */
const STACKED_BAR: BarShapeProps = { stackId: STACK_ID, stroke: SURFACE_COLOR, strokeWidth: SURFACE_GAP_PX, radius: FLAT_RADIUS };
/** The top segment of a stack: rounded like a grouped bar. */
const STACKED_TOP_BAR: BarShapeProps = { ...STACKED_BAR, radius: BAR_RADIUS };

/** Props recharts hands a custom `dot` / `activeDot`. */
interface DotRenderProps {
	readonly cx?: number | undefined;
	readonly cy?: number | undefined;
	readonly index?: number | undefined;
}

/** A recharts `dot` renderer drawing the slot's marker shape at each point. */
function markerRenderer(shape: ChartMarkerShape, color: string, radius: number): (props: DotRenderProps) => React.ReactElement {
	return function SlotMarker({ cx, cy, index }: DotRenderProps): React.ReactElement {
		if (cx === undefined || cy === undefined) {
			return <g key={`empty-${String(index ?? 0)}`} />;
		}
		return (
			<g key={`marker-${String(index ?? 0)}`}>
				<ChartMarker shape={shape} cx={cx} cy={cy} r={radius} color={color} />
			</g>
		);
	};
}

/** Props recharts hands a `LabelList` content renderer. */
interface LabelRenderProps {
	readonly x?: number | string | undefined;
	readonly y?: number | string | undefined;
	readonly index?: number | undefined;
}

function shortLabel(label: string): string {
	return label.length > DIRECT_LABEL_MAX_CHARS ? `${label.slice(0, DIRECT_LABEL_MAX_CHARS - 1)}…` : label;
}

/** Names a line at its last point — a direct label, so a reader never matches grays or hues to the legend. */
function endLabelRenderer(label: string, lastIndex: number): (props: LabelRenderProps) => React.ReactElement | null {
	return function EndLabel({ x, y, index }: LabelRenderProps): React.ReactElement | null {
		if (index !== lastIndex || !isNumberPrimitive(x) || !isNumberPrimitive(y)) {
			return null;
		}
		return (
			<text x={x + DIRECT_LABEL_OFFSET_PX} y={y} dominantBaseline="middle" fontSize={DIRECT_LABEL_FONT_SIZE_PX} fill="var(--muted-foreground)">
				{shortLabel(label)}
			</text>
		);
	};
}

/** Everything one series draws with, built once per series change. */
interface SeriesMarks<TKey extends string> {
	readonly definition: TimeSeriesDefinition<TKey>;
	readonly color: string;
	readonly dash: string | undefined;
	readonly dot: ((props: DotRenderProps) => React.ReactElement) | false;
	readonly activeDot: (props: DotRenderProps) => React.ReactElement;
	readonly endLabel: (props: LabelRenderProps) => React.ReactElement | null;
}

/** A recharts row: the bucket start (x) plus one numeric field per series. */
type ChartRow = Readonly<Record<string, number>>;

function toChartConfig<TKey extends string>(series: readonly TimeSeriesDefinition<TKey>[]): ChartConfig {
	return Object.fromEntries(series.map((definition) => [definition.key, { label: definition.label, color: CHART_SLOT_COLORS[definition.color] }]));
}

function toChartRows<TKey extends string>(points: readonly TimeSeriesPoint<TKey>[], series: readonly TimeSeriesDefinition<TKey>[]): ChartRow[] {
	return points.map((point): ChartRow => ({ start: point.start, ...Object.fromEntries(series.map((definition) => [definition.key, point.values[definition.key]])) }));
}

function readBucketStart(value: number | string | undefined): number | undefined {
	if (value === undefined) {
		return undefined;
	}
	const start = Number(value);
	return Number.isFinite(start) ? start : undefined;
}

interface LegendProps<TKey extends string> {
	readonly series: readonly TimeSeriesDefinition<TKey>[];
	readonly kind: TimeSeriesKind;
	readonly scope: string;
}

/** The legend mirrors the mark: dash + marker for lines, the slot's pattern for bars and areas — identity never rests on colour. */
function SeriesLegend<TKey extends string>({ series, kind, scope }: LegendProps<TKey>): React.JSX.Element {
	return (
		<ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
			{series.map((definition) => (
				<li key={definition.key} className="flex items-center gap-1.5">
					<SeriesKey slot={definition.color} kind={kind === "line" ? "line" : "fill"} scope={`${scope}-legend`} />
					<span>{definition.label}</span>
				</li>
			))}
		</ul>
	);
}

interface SeriesTooltipProps<TKey extends string> {
	/** Forwarded to the root (React 19 ref-as-prop, so the component stays generic). */
	readonly ref?: React.Ref<HTMLDivElement>;
	readonly point: TimeSeriesPoint<TKey>;
	readonly series: readonly TimeSeriesDefinition<TKey>[];
	readonly formatValue: (value: number) => string;
	readonly bucketLabel: string;
	readonly partialLabel: string;
	/** Which key the rows show — the chart's own mark. */
	readonly keyKind?: "line" | "fill";
	readonly scope?: string;
}

/** One readout for every series at the hovered / focused bucket — values lead, names follow. */
export function SeriesTooltip<TKey extends string>({
	ref,
	point,
	series,
	formatValue,
	bucketLabel,
	partialLabel,
	keyKind = "line",
	scope = "tooltip",
}: SeriesTooltipProps<TKey>): React.JSX.Element {
	return (
		<div ref={ref} className="grid min-w-40 gap-1.5 rounded-lg border border-border/60 bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
			<p className="font-medium text-foreground">
				{bucketLabel}
				{point.isPartial ? <span className="ms-1.5 font-normal text-muted-foreground">({partialLabel})</span> : null}
			</p>
			<ul className="grid gap-1">
				{series.map((definition) => (
					<li key={definition.key} className="flex items-center gap-2">
						<SeriesKey slot={definition.color} kind={keyKind} scope={`${scope}-tooltip`} />
						<span className="font-semibold text-foreground tabular-nums">{formatValue(point.values[definition.key])}</span>
						<span className="text-muted-foreground">{definition.label}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

interface DataTableProps<TKey extends string> {
	readonly title: string;
	readonly points: readonly TimeSeriesPoint<TKey>[];
	readonly series: readonly TimeSeriesDefinition<TKey>[];
	readonly formatValue: (value: number) => string;
	readonly formatBucketLabel: (point: TimeSeriesPoint<TKey>) => string;
	readonly labels: TimeSeriesChartLabels;
}

/** The chart's table twin: every value reachable without hovering (native disclosure, keyboard operable). */
function SeriesDataTable<TKey extends string>({ title, points, series, formatValue, formatBucketLabel, labels }: DataTableProps<TKey>): React.JSX.Element {
	return (
		<details className="group mt-3 text-sm">
			<summary className="w-fit cursor-pointer rounded-sm text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
				{labels.showTable}
			</summary>
			<div className="mt-2 max-h-80 overflow-auto">
				<Table>
					<TableCaption className="sr-only">{title}</TableCaption>
					<TableHeader>
						<TableRow>
							<TableHead scope="col">{labels.period}</TableHead>
							{series.map((definition) => (
								<TableHead key={definition.key} scope="col" className="text-right">
									{definition.label}
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{points.map((point) => (
							<TableRow key={point.start}>
								<TableHead scope="row" className="font-normal">
									{formatBucketLabel(point)}
									{point.isPartial ? <span className="ms-1.5 text-muted-foreground">({labels.partial})</span> : null}
								</TableHead>
								{series.map((definition) => (
									<TableCell key={definition.key} className="text-right tabular-nums">
										{formatValue(point.values[definition.key])}
									</TableCell>
								))}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</details>
	);
}

interface PlotProps<TKey extends string> {
	readonly rows: readonly ChartRow[];
	readonly points: readonly TimeSeriesPoint<TKey>[];
	readonly series: readonly TimeSeriesDefinition<TKey>[];
	readonly kind: TimeSeriesKind;
	readonly formatValue: (value: number) => string;
	readonly formatAxisValue: (value: number) => string;
	readonly formatBucketTick: (point: TimeSeriesPoint<TKey>) => string;
	readonly formatBucketLabel: (point: TimeSeriesPoint<TKey>) => string;
	readonly partialLabel: string;
	readonly axisWidth: number;
	readonly scope: string;
}

function Plot<TKey extends string>({
	rows,
	points,
	series,
	kind,
	formatValue,
	formatAxisValue,
	formatBucketTick,
	formatBucketLabel,
	partialLabel,
	axisWidth,
	scope,
}: PlotProps<TKey>): React.JSX.Element {
	const isReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY, true);
	const animate = !isReducedMotion;
	const config = React.useMemo((): ChartConfig => toChartConfig(series), [series]);
	const pointByStart = React.useMemo((): ReadonlyMap<number, TimeSeriesPoint<TKey>> => new Map(points.map((point) => [point.start, point])), [points]);
	const partialStarts = React.useMemo((): readonly number[] => points.filter((point) => point.isPartial).map((point) => point.start), [points]);

	const formatTick = React.useCallback(
		(value: number | string): string => {
			const start = readBucketStart(value);
			const point = start === undefined ? undefined : pointByStart.get(start);
			return point === undefined ? "" : formatBucketTick(point);
		},
		[formatBucketTick, pointByStart],
	);

	const renderTooltip = React.useCallback(
		(props: TooltipContentProps): React.ReactNode => {
			const start = readBucketStart(props.label);
			const point = start === undefined ? undefined : pointByStart.get(start);
			if (!props.active || point === undefined) {
				return null;
			}
			return (
				<SeriesTooltip
					point={point}
					series={series}
					formatValue={formatValue}
					bucketLabel={formatBucketLabel(point)}
					partialLabel={partialLabel}
					keyKind={kind === "line" ? "line" : "fill"}
					scope={scope}
				/>
			);
		},
		[formatBucketLabel, formatValue, kind, partialLabel, pointByStart, scope, series],
	);

	const showMarkers = points.length <= MAX_MARKED_POINTS;
	const directLabels = kind === "line" && series.length > 1;
	const lastPointIndex = points.length - 1;
	const lastIndex = series.length - 1;
	// Recharts types `data` as a mutable array; one copy per `rows` change, not per render.
	const data = React.useMemo((): ChartRow[] => [...rows], [rows]);
	const slots = React.useMemo((): readonly ChartColorSlot[] => series.map((definition) => definition.color), [series]);
	// The dot / active-dot / end-label renderers are components to recharts: rebuilt only when what they draw changes.
	const marks = React.useMemo(
		(): readonly SeriesMarks<TKey>[] =>
			series.map((definition): SeriesMarks<TKey> => {
				const encoding = CHART_SLOT_ENCODINGS[definition.color];
				const color = CHART_SLOT_COLORS[definition.color];
				return {
					definition,
					color,
					dash: encoding.dash,
					dot: showMarkers ? markerRenderer(encoding.marker, color, MARKER_RADIUS_PX) : false,
					activeDot: markerRenderer(encoding.marker, color, ACTIVE_MARKER_RADIUS_PX),
					endLabel: endLabelRenderer(definition.label, lastPointIndex),
				};
			}),
		[lastPointIndex, series, showMarkers],
	);

	const grid = <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={GRID_STROKE_OPACITY} />;
	const xAxis = (
		<XAxis dataKey="start" type="category" tickLine={false} axisLine={false} tickMargin={TICK_MARGIN_PX} minTickGap={MIN_TICK_GAP_PX} tickFormatter={formatTick} />
	);
	const yAxis = <YAxis tickLine={false} axisLine={false} width={axisWidth} tickFormatter={formatAxisValue} allowDecimals={false} />;
	const tooltip = <ChartTooltip cursor={kind === "line" || kind === "area" ? LINE_CURSOR : BAR_CURSOR} content={renderTooltip} />;
	const partialShading = partialStarts.map((start) => (
		<ReferenceArea key={start} x1={start} x2={start} fill="var(--muted)" fillOpacity={PARTIAL_FILL_OPACITY} ifOverflow="hidden" />
	));

	return (
		<ChartContainer config={config} className="aspect-auto h-72 w-full">
			{kind === "line" ? (
				<LineChart data={data} accessibilityLayer {...(directLabels ? { margin: DIRECT_LABEL_MARGIN } : {})}>
					{grid}
					{partialShading}
					{xAxis}
					{yAxis}
					{tooltip}
					{marks.map(({ definition, color, dash, dot, activeDot, endLabel }) => (
						<Line
							key={definition.key}
							dataKey={definition.key}
							name={definition.label}
							type="monotone"
							stroke={color}
							strokeWidth={LINE_WIDTH_PX}
							{...(dash === undefined ? {} : { strokeDasharray: dash })}
							strokeLinecap="round"
							strokeLinejoin="round"
							dot={dot}
							activeDot={activeDot}
							isAnimationActive={animate}>
							{directLabels ? <LabelList dataKey={definition.key} content={endLabel} /> : null}
						</Line>
					))}
				</LineChart>
			) : kind === "area" ? (
				<AreaChart data={data} accessibilityLayer>
					{grid}
					{partialShading}
					{xAxis}
					{yAxis}
					{tooltip}
					{marks.map(({ definition, color, dash, activeDot }) => (
						<Area
							key={definition.key}
							dataKey={definition.key}
							name={definition.label}
							type="monotone"
							stroke={color}
							strokeWidth={LINE_WIDTH_PX}
							{...(dash === undefined ? {} : { strokeDasharray: dash })}
							fill={color}
							fillOpacity={AREA_FILL_OPACITY}
							activeDot={activeDot}
							isAnimationActive={animate}
						/>
					))}
				</AreaChart>
			) : (
				<BarChart data={data} accessibilityLayer barGap={GROUPED_BAR_GAP_PX}>
					<ChartPatternDefs scope={scope} slots={slots} />
					{grid}
					{partialShading}
					{xAxis}
					{yAxis}
					{tooltip}
					{series.map((definition, index) => (
						<Bar
							key={definition.key}
							dataKey={definition.key}
							name={definition.label}
							fill={chartFill(scope, definition.color)}
							maxBarSize={MAX_BAR_THICKNESS_PX}
							{...(kind === "stackedBar" ? (index === lastIndex ? STACKED_TOP_BAR : STACKED_BAR) : GROUPED_BAR)}
							isAnimationActive={animate}
						/>
					))}
				</BarChart>
			)}
		</ChartContainer>
	);
}

/**
 * A time series as a line, area or (stacked) bar chart over one y-axis. Every
 * bucket is labelled by the caller's formatter (in the report's time zone);
 * partial buckets are shaded and named in the tooltip and table; ≥ 2 series
 * get a legend; the plot is keyboard-navigable (recharts' accessibility layer)
 * and every value is also in the table disclosure. Animations follow
 * `prefers-reduced-motion`.
 */
export function TimeSeriesChart<TKey extends string>({
	ref,
	title,
	points,
	series,
	kind,
	formatValue,
	formatAxisValue,
	formatBucketTick,
	formatBucketLabel,
	labels: labelsOverride,
	state = CHART_READY,
	axisWidth = DEFAULT_AXIS_WIDTH_PX,
	className,
	...props
}: TimeSeriesChartProps<TKey>): React.JSX.Element {
	const labels = useUiKitLabels("timeSeriesChart", labelsOverride);
	const rows = React.useMemo((): readonly ChartRow[] => toChartRows(points, series), [points, series]);
	// SVG ids must be unique on the page: one scope per chart instance.
	const scope = `ts${React.useId().replace(/[^a-zA-Z0-9]/g, "")}`;
	const hasPartial = points.some((point) => point.isPartial);
	const partialLabel = labels.partial;
	// The recharts plot is the expensive subtree: the same element is reused until one of its inputs
	// changes, so React skips re-rendering it when only the frame around it does (React.memo would
	// erase the series-key type parameter).
	const plot = React.useMemo(
		(): React.JSX.Element => (
			<Plot
				rows={rows}
				points={points}
				series={series}
				kind={kind}
				formatValue={formatValue}
				formatAxisValue={formatAxisValue}
				formatBucketTick={formatBucketTick}
				formatBucketLabel={formatBucketLabel}
				partialLabel={partialLabel}
				axisWidth={axisWidth}
				scope={scope}
			/>
		),
		[axisWidth, formatAxisValue, formatBucketLabel, formatBucketTick, formatValue, kind, partialLabel, points, rows, scope, series],
	);

	return (
		<figure ref={ref} aria-label={title} className={cn("m-0 flex min-w-0 flex-col gap-3", className)} {...props}>
			{series.length > 1 ? <SeriesLegend series={series} kind={kind} scope={scope} /> : null}
			<ChartStateFrame state={state}>
				{plot}
				{hasPartial ? (
					<figcaption className="flex items-center gap-2 text-xs text-muted-foreground">
						<span aria-hidden="true" className="size-2.5 shrink-0 rounded-xs bg-muted ring-1 ring-border" />
						{labels.partialNote}
					</figcaption>
				) : null}
				<SeriesDataTable title={title} points={points} series={series} formatValue={formatValue} formatBucketLabel={formatBucketLabel} labels={labels} />
			</ChartStateFrame>
		</figure>
	);
}
