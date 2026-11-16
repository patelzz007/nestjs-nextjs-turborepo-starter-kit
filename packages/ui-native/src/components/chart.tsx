// Charts drawn with react-native-svg, the web kit's recharts charts for a phone: bars (vertical or horizontal,
// rounded, thin, or as 3D blocks), areas and lines (smooth, straight or stepped; stacked; glowing), pies and
// donuts (with a centre and an active slice), radars, and radial bars. A series is filled solid, with a gradient,
// or with a texture (stripes, dots, a crosshatch): texture tells series apart without colour alone.
//
// A phone has no hover: a tap on a category selects it, the chart marks it, and a readout above the plot shows
// its values (the web's tooltip). Every category is its own accessible element that reads its values, and the
// plot itself is an image named by `accessibilityLabel`, so the chart is never colour-only or picture-only.
//
// Colours are the theme's chart tokens (`chart-1` … `chart-5`, plus the destructive and ink tones), read with
// `useCSSVariable`: react-native-svg takes colour values, not classes. Until the stylesheet resolves them the plot
// draws nothing rather than a wrong colour. The geometry (scales, bands, curves, arcs) is `lib/chart`.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { type LayoutChangeEvent, Pressable, Text, View, type ViewInstance, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Pattern, Rect, Stop } from "react-native-svg";
import { useCSSVariable } from "uniwind";
import { z } from "zod";

import {
	arcPath,
	chartAreaPath,
	chartBands,
	chartBarPath,
	chartLinePath,
	chartPointXs,
	niceScale,
	pieSlices,
	polarPoint,
	polygonPath,
	radarPoints,
	radialSweep,
	stackedTotals,
	type ChartCurve,
	type ChartPoint,
} from "../lib/chart";
import { cn } from "../lib/cn";

// ── Colours and fills ─────────────────────────────────────────────────────

/** A series' colour: one of the theme's chart tokens, or a tone with a meaning (destructive for "critical"). */
export type ChartColor = "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5" | "destructive" | "foreground" | "muted-foreground";

/** How a gradient fades: from strong to faint down the mark (`fade`, `soft`, `deep`), rising across it, or split in two. */
export type ChartGradientTone = "fade" | "soft" | "deep" | "rising" | "duotone";

/** How a series' marks are filled. */
export type ChartFill =
	| { readonly kind: "solid" }
	| { readonly kind: "gradient"; readonly tone: ChartGradientTone; readonly direction?: "down" | "right" | "diagonal" | undefined }
	| { readonly kind: "stripes" }
	| { readonly kind: "dots" }
	| { readonly kind: "crosshatch" };

/** Each gradient tone's stops: offset (0–1) and opacity. A hard stop repeats an offset. */
const GRADIENT_STOPS: Readonly<Record<ChartGradientTone, readonly (readonly [number, number])[]>> = {
	fade: [
		[0, 0.7],
		[0.5, 0.4],
		[1, 0.2],
	],
	soft: [
		[0.05, 0.5],
		[0.95, 0.05],
	],
	deep: [
		[0, 0.9],
		[1, 0.7],
	],
	rising: [
		[0, 0.5],
		[1, 1],
	],
	duotone: [
		[0.5, 0.4],
		[0.5, 1],
	],
};

/** A texture's tile, in points, and its tint under the marks. */
const TEXTURE_TILE = 6;
const TEXTURE_TINT = 0.1;
const TEXTURE_INK = 0.6;
const TEXTURE_STROKE = 1.5;
const DOT_RADIUS = 1.2;

/** The fill's id inside one chart's `<Defs>`. */
function fillId(chartId: string, key: string): string {
	return `${chartId}-${key}`;
}

function fillValue(fill: ChartFill | undefined, chartId: string, key: string, color: string): string {
	return fill === undefined || fill.kind === "solid" ? color : `url(#${fillId(chartId, key)})`;
}

const GRADIENT_VECTORS = { down: { x2: "0", y2: "1" }, right: { x2: "1", y2: "0" }, diagonal: { x2: "1", y2: "1" } };

/** One series' gradient or texture, for the chart's `<Defs>`. */
function FillDefinition({ id, fill, color }: { readonly id: string; readonly fill: ChartFill | undefined; readonly color: string }): React.JSX.Element | null {
	if (fill === undefined || fill.kind === "solid") {
		return null;
	}
	if (fill.kind === "gradient") {
		const vector = GRADIENT_VECTORS[fill.direction ?? "down"];
		return (
			<LinearGradient id={id} x1="0" y1="0" x2={vector.x2} y2={vector.y2}>
				{GRADIENT_STOPS[fill.tone].map(([offset, opacity]): React.JSX.Element => (
					<Stop key={`${String(offset)}-${String(opacity)}`} offset={offset} stopColor={color} stopOpacity={opacity} />
				))}
			</LinearGradient>
		);
	}
	return (
		<Pattern id={id} patternUnits="userSpaceOnUse" width={TEXTURE_TILE} height={TEXTURE_TILE}>
			<Rect width={TEXTURE_TILE} height={TEXTURE_TILE} fill={color} opacity={TEXTURE_TINT} />
			{fill.kind === "dots" ? <Circle cx={TEXTURE_TILE / 2} cy={TEXTURE_TILE / 2} r={DOT_RADIUS} fill={color} opacity={TEXTURE_INK} /> : null}
			{fill.kind === "stripes" ? <Path d={`M0,${String(TEXTURE_TILE)} L${String(TEXTURE_TILE)},0`} stroke={color} strokeWidth={TEXTURE_STROKE} opacity={TEXTURE_INK} /> : null}
			{fill.kind === "crosshatch" ? (
				<Path
					d={`M0,0 L${String(TEXTURE_TILE)},${String(TEXTURE_TILE)} M${String(TEXTURE_TILE)},0 L0,${String(TEXTURE_TILE)}`}
					stroke={color}
					strokeWidth={1}
					opacity={TEXTURE_INK}
				/>
			) : null}
		</Pattern>
	);
}

const ColorSchema = z.string();

/** The theme's chart colours, resolved; `null` until the stylesheet has them. */
interface ChartPalette {
	readonly series: Readonly<Record<ChartColor, string>>;
	readonly grid: string;
	readonly surface: string;
	readonly track: string;
}

function useChartPalette(): ChartPalette | null {
	const [chart1, chart2, chart3, chart4, chart5, destructive, foreground, mutedForeground, grid, surface, track] = [
		useCSSVariable("--color-chart-1"),
		useCSSVariable("--color-chart-2"),
		useCSSVariable("--color-chart-3"),
		useCSSVariable("--color-chart-4"),
		useCSSVariable("--color-chart-5"),
		useCSSVariable("--color-destructive"),
		useCSSVariable("--color-foreground"),
		useCSSVariable("--color-muted-foreground"),
		useCSSVariable("--color-border"),
		useCSSVariable("--color-background"),
		useCSSVariable("--color-muted"),
	].map((value): string | undefined => ColorSchema.safeParse(value).data);
	if (
		chart1 === undefined ||
		chart2 === undefined ||
		chart3 === undefined ||
		chart4 === undefined ||
		chart5 === undefined ||
		destructive === undefined ||
		foreground === undefined ||
		mutedForeground === undefined ||
		grid === undefined ||
		surface === undefined ||
		track === undefined
	) {
		return null;
	}
	return {
		series: { "chart-1": chart1, "chart-2": chart2, "chart-3": chart3, "chart-4": chart4, "chart-5": chart5, destructive, foreground, "muted-foreground": mutedForeground },
		grid,
		surface,
		track,
	};
}

/** The plot's test id, from the chart's. */
function plotTestId(testID: string | undefined): string | undefined {
	return testID === undefined ? undefined : `${testID}-plot`;
}

/** One chart's own id for its `<Defs>` (React's ids carry characters SVG references do not take). */
function useChartId(): string {
	return `chart${React.useId().replace(/[^a-zA-Z0-9]/gu, "")}`;
}

/** The plot's width, measured once it is laid out. */
function useMeasuredWidth(): readonly [number, (event: LayoutChangeEvent) => void] {
	const [width, setWidth] = React.useState(0);
	const handleLayout = React.useCallback((event: LayoutChangeEvent): void => {
		setWidth(event.nativeEvent.layout.width);
	}, []);
	return [width, handleLayout];
}

// ── Shared parts ──────────────────────────────────────────────────────────

/** A series of a cartesian chart (bars, areas, lines). */
export interface ChartSeries {
	/** The key of its values in each datum. */
	readonly key: string;
	readonly label: string;
	readonly color: ChartColor;
	/** Default solid. */
	readonly fill?: ChartFill | undefined;
	/** Draws a 1 pt outline in the series colour around textured bars. */
	readonly outline?: boolean | undefined;
	/** Area charts: `area` (the default) or `line` (a stroke only). */
	readonly kind?: "area" | "line" | undefined;
	/** Area charts: the stroke's weight. Default `regular`. */
	readonly stroke?: "none" | "thin" | "regular" | "bold" | undefined;
	/** Area charts: a dashed stroke. */
	readonly dashed?: boolean | undefined;
}

/** One category (a month): its label, and each series' value by key. */
export interface ChartDatum {
	readonly label: string;
	readonly values: Readonly<Record<string, number>>;
}

type ValueFormatter = (value: number) => string;
type CategoryFormatter = (label: string) => string;

function defaultFormat(value: number): string {
	return String(value);
}

function identity(label: string): string {
	return label;
}

function valueOf(datum: ChartDatum | undefined, key: string): number {
	return datum?.values[key] ?? 0;
}

/** What a category says to a screen reader: "March: Desktop 400, Mobile 280". */
export function describeChartDatum(datum: ChartDatum, series: readonly ChartSeries[], formatValue: ValueFormatter = defaultFormat): string {
	return `${datum.label}: ${series.map((entry): string => `${entry.label} ${formatValue(valueOf(datum, entry.key))}`).join(", ")}`;
}

const STROKE_WIDTHS = { none: 0, thin: 1, regular: 2, bold: 2.5 };

export const chartVariants = cva("w-full gap-3");

export const chartPlotVariants = cva("w-full", {
	variants: { size: { sm: "h-40", md: "h-56", lg: "h-72" } },
	defaultVariants: { size: "md" },
});

/** The square plot of a round chart (pie, radar, radial bars). */
export const chartRoundPlotVariants = cva("aspect-square w-full self-center", {
	variants: { size: { sm: "max-w-48", md: "max-w-64", lg: "max-w-80" } },
	defaultVariants: { size: "md" },
});

export const chartSwatchVariants = cva("size-2.5 rounded-sm");

export type ChartSize = NonNullable<VariantProps<typeof chartPlotVariants>["size"]>;

/** A legend swatch's colour: the series colour as a class (a view, so classes apply). */
const SWATCH_CLASSES: Readonly<Record<ChartColor, string>> = {
	"chart-1": "bg-chart-1",
	"chart-2": "bg-chart-2",
	"chart-3": "bg-chart-3",
	"chart-4": "bg-chart-4",
	"chart-5": "bg-chart-5",
	destructive: "bg-destructive",
	foreground: "bg-foreground",
	"muted-foreground": "bg-muted-foreground",
};

/** One legend entry. */
export interface ChartLegendItem {
	readonly key: string;
	readonly label: string;
	readonly color: ChartColor;
	/** A value after the label ("58"). */
	readonly value?: string | undefined;
}

export interface ChartLegendProps {
	readonly items: readonly ChartLegendItem[];
	/** Makes each entry a button that selects its series or slice. */
	readonly onItemPress?: ((key: string) => void) | undefined;
	readonly activeKey?: string | null | undefined;
	/** Extra classes for the row, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

const LegendEntry = React.memo(function LegendEntry({
	item,
	onPress,
	active,
}: {
	readonly item: ChartLegendItem;
	readonly onPress: ((key: string) => void) | undefined;
	readonly active: boolean;
}): React.JSX.Element {
	const handlePress = React.useCallback((): void => {
		onPress?.(item.key);
	}, [item.key, onPress]);
	const body = (
		<>
			<View className={cn(chartSwatchVariants(), SWATCH_CLASSES[item.color])} />
			<Text className={cn("text-caption font-sans", active ? "text-foreground" : "text-muted-foreground")}>{item.label}</Text>
			{item.value === undefined ? null : <Text className="text-caption font-sans-medium text-foreground tabular-nums">{item.value}</Text>}
		</>
	);
	const label = item.value === undefined ? item.label : `${item.label} ${item.value}`;
	if (onPress === undefined) {
		return (
			<View accessible accessibilityLabel={label} className="flex-row items-center gap-1.5">
				{body}
			</View>
		);
	}
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={active ? SELECTED : NOT_SELECTED}
			onPress={handlePress}
			className="min-h-11 flex-row items-center gap-1.5 active:opacity-70">
			{body}
		</Pressable>
	);
});

const SELECTED = { selected: true };
const NOT_SELECTED = { selected: false };

/** The series a chart shows, by colour: always present for two or more series, so colour is never the only key. */
export const ChartLegend = React.memo(
	React.forwardRef<ViewInstance, ChartLegendProps>(function ChartLegend({ items, onItemPress, activeKey, className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} testID={testID} className={cn("flex-row flex-wrap items-center justify-center gap-x-4 gap-y-1", className)}>
				{items.map((item): React.JSX.Element => (
					<LegendEntry key={item.key} item={item} onPress={onItemPress} active={activeKey === item.key} />
				))}
			</View>
		);
	}),
);

/** The selected category's values (the web's tooltip): its label, then a swatch, name and value per series. */
function ChartReadout({
	datum,
	series,
	formatValue,
}: {
	readonly datum: ChartDatum;
	readonly series: readonly ChartSeries[];
	readonly formatValue: ValueFormatter;
}): React.JSX.Element {
	return (
		<View accessibilityLiveRegion="polite" className="gap-1 rounded-lg bg-muted/60 px-3 py-2">
			<Text className="text-caption font-sans-medium text-foreground">{datum.label}</Text>
			{series.map((entry): React.JSX.Element => (
				<View key={entry.key} className="flex-row items-center gap-2">
					<View className={cn(chartSwatchVariants(), SWATCH_CLASSES[entry.color])} />
					<Text className="text-caption flex-1 font-sans text-muted-foreground">{entry.label}</Text>
					<Text className="text-caption font-sans-medium text-foreground tabular-nums">{formatValue(valueOf(datum, entry.key))}</Text>
				</View>
			))}
		</View>
	);
}

/** A tap target over one category: selects it, and reads its values to a screen reader. */
const CategoryTarget = React.memo(function CategoryTarget({
	index,
	label,
	selected,
	style,
	onSelect,
}: {
	readonly index: number;
	readonly label: string;
	readonly selected: boolean;
	readonly style: ViewStyle;
	readonly onSelect: (index: number) => void;
}): React.JSX.Element {
	const handlePress = React.useCallback((): void => {
		onSelect(index);
	}, [index, onSelect]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={selected ? SELECTED : NOT_SELECTED}
			onPress={handlePress}
			style={style}
			className="absolute"
		/>
	);
});

/** Selection, controlled (`selectedIndex` with `onSelectedIndexChange`) or the chart's own; a second tap clears it. */
function useSelection(selectedIndex: number | null | undefined, onChange: ((index: number | null) => void) | undefined): readonly [number | null, (index: number) => void] {
	const [own, setOwn] = React.useState<number | null>(null);
	const current = selectedIndex === undefined ? own : selectedIndex;
	const select = React.useCallback(
		(index: number): void => {
			const next = current === index ? null : index;
			setOwn(next);
			onChange?.(next);
		},
		[current, onChange],
	);
	return [current, select];
}

/** The gap left between bands, as a share of each band's slot. */
const BAND_GAP = 0.2;
/** The space under a plot for its category labels, in points. */
const AXIS_HEIGHT = 24;
/** The width of a horizontal chart's category column, in points (the `w-12` label column). */
const CATEGORY_COLUMN = 48;
const GRID_DASH = "3 3";
const NO_SHIFT = "translate(0,0)";
const CATEGORY_SHIFT = `translate(${String(CATEGORY_COLUMN)},0)`;
/** A solid line, where a dashed one would set its dashes. */
const SOLID: readonly number[] = [];
/** No outline (SVG's "none"). */
const NO_STROKE = "none";

/** Category labels positioned under (or beside) their bands. */
function CategoryLabels({ labels, styles }: { readonly labels: readonly string[]; readonly styles: readonly ViewStyle[] }): React.JSX.Element {
	return (
		<View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="absolute inset-0">
			{labels.map((label, index): React.JSX.Element => (
				<Text key={`${label}-${String(index)}`} numberOfLines={1} style={styles.at(index)} className="text-overline absolute text-center font-sans text-muted-foreground">
					{label}
				</Text>
			))}
		</View>
	);
}

/** The props every cartesian chart takes. */
interface CartesianChartProps {
	readonly data: readonly ChartDatum[];
	readonly series: readonly ChartSeries[];
	/** What the chart shows, for screen readers ("Monthly revenue, 2024"). */
	readonly accessibilityLabel: string;
	readonly size?: ChartSize | undefined;
	/** Horizontal gridlines. Default `solid`. */
	readonly grid?: "solid" | "dashed" | "none" | undefined;
	/** A legend under the plot. Default: shown for two or more series. */
	readonly legend?: boolean | undefined;
	/** The axis label for a category ("January" → "Jan"). */
	readonly formatCategory?: CategoryFormatter | undefined;
	/** A value as the readout and screen readers say it ("$2,400"). */
	readonly formatValue?: ValueFormatter | undefined;
	/** The selected category, controlled: `null` for none. */
	readonly selectedIndex?: number | null | undefined;
	readonly onSelectedIndexChange?: ((index: number | null) => void) | undefined;
	/** Extra classes for the root, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

function legendItemsOf(series: readonly ChartSeries[]): readonly ChartLegendItem[] {
	return series.map((entry): ChartLegendItem => ({ key: entry.key, label: entry.label, color: entry.color }));
}

/** Horizontal gridlines at each step of the scale. */
function GridLines({
	steps,
	width,
	height,
	color,
	dashed,
}: {
	readonly steps: number;
	readonly width: number;
	readonly height: number;
	readonly color: string;
	readonly dashed: boolean;
}): React.JSX.Element {
	return (
		<G>
			{Array.from({ length: steps + 1 }, (_, index): React.JSX.Element => {
				const y = (height * index) / steps;
				return <Line key={`grid-${y.toFixed(1)}`} x1={0} x2={width} y1={y} y2={y} stroke={color} strokeWidth={1} strokeDasharray={dashed ? GRID_DASH : SOLID} />;
			})}
		</G>
	);
}

// ── Bars ──────────────────────────────────────────────────────────────────

export interface BarChartProps extends CartesianChartProps {
	/** `vertical` (columns, the default) or `horizontal` (bars, categories down the side). */
	readonly orientation?: "vertical" | "horizontal" | undefined;
	/**
	 * `rounded` (the default); `thin` (narrow bars, the selected one widening with its value); `block` (3D blocks
	 * with shaded faces); `isometric` (3D blocks in one flat colour).
	 */
	readonly shape?: "rounded" | "thin" | "block" | "isometric" | undefined;
	/** The bar end's rounding. Default `md`. */
	readonly radius?: "none" | "sm" | "md" | "lg" | undefined;
}

const BAR_RADII = { none: 0, sm: 2, md: 4, lg: 6 };
/** The space between grouped bars of one category, in points. */
const GROUP_GAP = 2;
/** Thin bars: the share of each slot left empty, and when selected. */
const THIN_GAP = 0.75;
const THIN_SELECTED_GAP = 0.35;
/** A 3D block's depth, as a share of its width, and its faces' opacities (side, top). */
const BLOCK_DEPTH = 0.3;
const BLOCK_SIDE_OPACITY = 0.7;
const BLOCK_TOP_OPACITY = 0.85;
/** Room above the tallest bar, for a block's top face or a thin bar's value. */
const BAR_HEADROOM = 16;
/** Bars of the other categories while one is selected. */
const DIMMED = 0.45;

/** A bar drawn as a 3D block: its front, a sheared top and a sheared side. */
function BlockBar({
	x,
	y,
	width,
	height,
	fill,
	color,
	shaded,
	opacity,
}: {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly fill: string;
	readonly color: string;
	readonly shaded: boolean;
	readonly opacity: number;
}): React.JSX.Element {
	const depth = width * BLOCK_DEPTH;
	const top = `M${String(x)},${String(y)} L${String(x + depth)},${String(y - depth)} L${String(x + width + depth)},${String(y - depth)} L${String(x + width)},${String(y)} Z`;
	const side = `M${String(x + width)},${String(y)} L${String(x + width + depth)},${String(y - depth)} L${String(x + width + depth)},${String(y + height - depth)} L${String(x + width)},${String(y + height)} Z`;
	return (
		<G opacity={opacity}>
			<Path d={side} fill={color} opacity={shaded ? BLOCK_SIDE_OPACITY * BLOCK_SIDE_OPACITY : BLOCK_SIDE_OPACITY} />
			<Path d={top} fill={color} opacity={BLOCK_TOP_OPACITY} />
			<Rect x={x} y={y} width={width} height={height} fill={fill} />
		</G>
	);
}

export const BarChart = React.memo(
	React.forwardRef<ViewInstance, BarChartProps>(function BarChart(
		{
			data,
			series,
			accessibilityLabel,
			orientation = "vertical",
			shape = "rounded",
			radius = "md",
			size = "md",
			grid = "solid",
			legend,
			formatCategory = identity,
			formatValue = defaultFormat,
			selectedIndex,
			onSelectedIndexChange,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const palette = useChartPalette();
		const chartId = useChartId();
		const [width, handleLayout] = useMeasuredWidth();
		const [height, setHeight] = React.useState(0);
		const handlePlotLayout = React.useCallback(
			(event: LayoutChangeEvent): void => {
				handleLayout(event);
				setHeight(event.nativeEvent.layout.height);
			},
			[handleLayout],
		);
		const [selected, select] = useSelection(selectedIndex, onSelectedIndexChange);
		const vertical = orientation === "vertical";
		const plotWidth = vertical ? width : Math.max(0, width - CATEGORY_COLUMN);
		const plotHeight = vertical ? Math.max(0, height - AXIS_HEIGHT) : height;
		const scale = niceScale(Math.max(0, ...data.flatMap((datum): number[] => series.map((entry): number => valueOf(datum, entry.key)))));
		const bandLength = vertical ? plotWidth : plotHeight;
		const valueLength = (vertical ? plotHeight : plotWidth) - (vertical ? BAR_HEADROOM : 0);
		const bands = React.useMemo(() => chartBands(data.length, bandLength, shape === "thin" ? THIN_GAP : BAND_GAP), [bandLength, data.length, shape]);
		const targetStyles = React.useMemo(
			(): ViewStyle[] =>
				bands.map((band): ViewStyle => (vertical ? { left: band.start, width: band.size, top: 0, bottom: 0 } : { top: band.start, height: band.size, left: 0, right: 0 })),
			[bands, vertical],
		);
		const labelStyles = React.useMemo(
			(): ViewStyle[] =>
				bands.map((band): ViewStyle =>
					vertical ? { left: band.start - band.size, width: band.size * 3, top: plotHeight + 4 } : { left: 0, width: CATEGORY_COLUMN - 8, top: band.center - 8 },
				),
			[bands, plotHeight, vertical],
		);
		const selectedDatum = selected === null ? undefined : data.at(selected);
		const showLegend = legend ?? series.length > 1;

		const bars =
			palette === null || plotWidth <= 0 || plotHeight <= 0
				? null
				: data.flatMap((datum, index): React.JSX.Element[] => {
						const band = bands.at(index);
						if (band === undefined) {
							return [];
						}
						const isSelected = selected === index;
						const slot = shape === "thin" && isSelected ? (chartBands(data.length, bandLength, THIN_SELECTED_GAP).at(index) ?? band) : band;
						const thickness = (slot.size - GROUP_GAP * (series.length - 1)) / series.length;
						const opacity = selected === null || isSelected ? 1 : DIMMED;
						return series.map((entry, position): React.JSX.Element => {
							const length = (valueOf(datum, entry.key) / scale.top) * valueLength;
							const offset = slot.start + position * (thickness + GROUP_GAP);
							const color = palette.series[entry.color];
							const fill = fillValue(entry.fill, chartId, entry.key, color);
							const key = `${String(index)}-${entry.key}`;
							if (vertical && (shape === "block" || shape === "isometric")) {
								return (
									<BlockBar
										key={key}
										x={offset}
										y={plotHeight - length}
										width={thickness * (1 - BLOCK_DEPTH)}
										height={length}
										fill={fill}
										color={color}
										shaded={shape === "block"}
										opacity={opacity}
									/>
								);
							}
							const path = vertical
								? chartBarPath(offset, plotHeight - length, thickness, length, BAR_RADII[radius], "vertical")
								: chartBarPath(0, offset, length, thickness, BAR_RADII[radius], "horizontal");
							return (
								<Path key={key} d={path} fill={fill} opacity={opacity} stroke={entry.outline === true ? color : NO_STROKE} strokeWidth={entry.outline === true ? 1 : 0} />
							);
						});
					});

		const leadKey = series.at(0)?.key ?? "";
		const thinLabelStyle = React.useMemo((): ViewStyle | undefined => {
			const base = selected === null ? undefined : labelStyles.at(selected);
			if (shape !== "thin" || base === undefined || selectedDatum === undefined) {
				return undefined;
			}
			return { ...base, top: Math.max(0, plotHeight - (valueOf(selectedDatum, leadKey) / scale.top) * valueLength - BAR_HEADROOM) };
		}, [labelStyles, leadKey, plotHeight, scale.top, selected, selectedDatum, shape, valueLength]);
		const thinValue =
			thinLabelStyle === undefined || selectedDatum === undefined ? null : (
				<Text style={thinLabelStyle} className="text-overline font-sans-medium absolute text-center text-foreground tabular-nums">
					{formatValue(valueOf(selectedDatum, leadKey))}
				</Text>
			);

		return (
			<View ref={ref} testID={testID} className={cn(chartVariants(), className)}>
				{selectedDatum === undefined ? null : <ChartReadout datum={selectedDatum} series={series} formatValue={formatValue} />}
				<View onLayout={handlePlotLayout} testID={plotTestId(testID)} className={chartPlotVariants({ size })}>
					<View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} className="absolute inset-0">
						{palette === null || width <= 0 ? null : (
							<Svg width={width} height={height}>
								<Defs>
									{series.map((entry): React.JSX.Element => (
										<FillDefinition key={entry.key} id={fillId(chartId, entry.key)} fill={entry.fill} color={palette.series[entry.color]} />
									))}
								</Defs>
								<G transform={vertical ? NO_SHIFT : CATEGORY_SHIFT}>
									{grid === "none" || !vertical ? null : (
										<GridLines steps={Math.round(scale.top / scale.step)} width={plotWidth} height={plotHeight} color={palette.grid} dashed={grid === "dashed"} />
									)}
									{bars}
								</G>
							</Svg>
						)}
					</View>
					<CategoryLabels labels={data.map((datum): string => formatCategory(datum.label))} styles={labelStyles} />
					{thinValue}
					<View className={cn("absolute top-0 right-0 bottom-0", vertical ? "left-0" : "left-12")}>
						{data.map((datum, index): React.JSX.Element => (
							<CategoryTarget
								key={`${datum.label}-${String(index)}`}
								index={index}
								label={describeChartDatum(datum, series, formatValue)}
								selected={selected === index}
								style={targetStyles.at(index) ?? EMPTY_STYLE}
								onSelect={select}
							/>
						))}
					</View>
				</View>
				{showLegend ? <ChartLegend items={legendItemsOf(series)} /> : null}
			</View>
		);
	}),
);

const EMPTY_STYLE: ViewStyle = {};

// ── Areas and lines ───────────────────────────────────────────────────────

export interface AreaChartProps extends CartesianChartProps {
	/** How each line joins its points. Default `natural`. */
	readonly curve?: ChartCurve | undefined;
	/** Stacks the areas, first series at the bottom. */
	readonly stacked?: boolean | undefined;
	/** A dot on every point: `solid`, or `glow` (a soft halo). Default none. */
	readonly dots?: "none" | "solid" | "glow" | undefined;
	/** A soft halo under each line. */
	readonly glow?: boolean | undefined;
}

/** A line's halo: how much wider than the line, and how faint. */
const GLOW_SPREAD = 4;
const GLOW_OPACITY = 0.18;
const POINT_RADIUS = 3.5;
const SELECTED_POINT_RADIUS = 5;
/** Room around the plot so the end points and their dots are not clipped, in points. */
const LINE_INSET = 6;
const INSET_SHIFT = `translate(${String(LINE_INSET)},${String(LINE_INSET)})`;

export const AreaChart = React.memo(
	React.forwardRef<ViewInstance, AreaChartProps>(function AreaChart(
		{
			data,
			series,
			accessibilityLabel,
			curve = "natural",
			stacked = false,
			dots = "none",
			glow = false,
			size = "md",
			grid = "solid",
			legend,
			formatCategory = identity,
			formatValue = defaultFormat,
			selectedIndex,
			onSelectedIndexChange,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const palette = useChartPalette();
		const chartId = useChartId();
		const [width, handleLayout] = useMeasuredWidth();
		const [height, setHeight] = React.useState(0);
		const handlePlotLayout = React.useCallback(
			(event: LayoutChangeEvent): void => {
				handleLayout(event);
				setHeight(event.nativeEvent.layout.height);
			},
			[handleLayout],
		);
		const [selected, select] = useSelection(selectedIndex, onSelectedIndexChange);
		const plotWidth = Math.max(0, width - LINE_INSET * 2);
		const plotHeight = Math.max(0, height - AXIS_HEIGHT - LINE_INSET);
		const columns = series.map((entry): number[] => data.map((datum): number => valueOf(datum, entry.key)));
		const tops = stacked ? stackedTotals(columns) : columns;
		const scale = niceScale(Math.max(0, ...tops.flat()));
		const xs = React.useMemo(() => chartPointXs(data.length, plotWidth), [data.length, plotWidth]);
		const yOf = (value: number): number => LINE_INSET + plotHeight - (value / scale.top) * plotHeight;
		const pointsOf = (values: readonly number[]): ChartPoint[] => values.map((value, index): ChartPoint => ({ x: LINE_INSET + (xs.at(index) ?? 0), y: yOf(value) }));
		const baseline = pointsOf(data.map((): number => 0));
		const slot = data.length > 1 ? plotWidth / (data.length - 1) : plotWidth;
		const targetStyles = React.useMemo((): ViewStyle[] => xs.map((x): ViewStyle => ({ left: LINE_INSET + x - slot / 2, width: slot, top: 0, bottom: 0 })), [slot, xs]);
		const labelStyles = React.useMemo(
			(): ViewStyle[] => xs.map((x): ViewStyle => ({ left: LINE_INSET + x - slot / 2, width: slot, top: LINE_INSET + plotHeight + 4 })),
			[plotHeight, slot, xs],
		);
		const selectedDatum = selected === null ? undefined : data.at(selected);
		const showLegend = legend ?? series.length > 1;
		const selectedX = selected === null ? undefined : xs.at(selected);

		return (
			<View ref={ref} testID={testID} className={cn(chartVariants(), className)}>
				{selectedDatum === undefined ? null : <ChartReadout datum={selectedDatum} series={series} formatValue={formatValue} />}
				<View onLayout={handlePlotLayout} testID={plotTestId(testID)} className={chartPlotVariants({ size })}>
					<View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} className="absolute inset-0">
						{palette === null || width <= 0 || plotHeight <= 0 ? null : (
							<Svg width={width} height={height}>
								<Defs>
									{series.map((entry): React.JSX.Element => (
										<FillDefinition key={entry.key} id={fillId(chartId, entry.key)} fill={entry.fill} color={palette.series[entry.color]} />
									))}
								</Defs>
								{grid === "none" ? null : (
									<G transform={INSET_SHIFT}>
										<GridLines steps={Math.round(scale.top / scale.step)} width={plotWidth} height={plotHeight} color={palette.grid} dashed={grid === "dashed"} />
									</G>
								)}
								{selectedX === undefined ? null : (
									<Line x1={LINE_INSET + selectedX} x2={LINE_INSET + selectedX} y1={LINE_INSET} y2={LINE_INSET + plotHeight} stroke={palette.grid} strokeWidth={1} />
								)}
								{series.map((entry, index): React.JSX.Element => {
									const color = palette.series[entry.color];
									const top = pointsOf(tops.at(index) ?? []);
									const bottom = stacked && index > 0 ? pointsOf(tops.at(index - 1) ?? []) : baseline;
									const strokeWidth = STROKE_WIDTHS[entry.stroke ?? "regular"];
									const line = chartLinePath(top, curve);
									return (
										<G key={entry.key}>
											{entry.kind === "line" ? null : <Path d={chartAreaPath(top, bottom, curve)} fill={fillValue(entry.fill ?? SOFT_GRADIENT, chartId, entry.key, color)} />}
											{glow && strokeWidth > 0 ? (
												<Path d={line} fill="none" stroke={color} strokeWidth={strokeWidth * GLOW_SPREAD} strokeOpacity={GLOW_OPACITY} strokeLinecap="round" />
											) : null}
											{strokeWidth > 0 ? (
												<Path
													d={line}
													fill="none"
													stroke={color}
													strokeWidth={strokeWidth}
													strokeDasharray={entry.dashed === true ? GRID_DASH : SOLID}
													strokeLinecap="round"
													strokeLinejoin="round"
												/>
											) : null}
											{top.map((point, position): React.JSX.Element | null => {
												const isSelected = selected === position;
												if (dots === "none" && !isSelected) {
													return null;
												}
												const radius = isSelected ? SELECTED_POINT_RADIUS : POINT_RADIUS;
												return (
													<G key={data.at(position)?.label ?? `point-${point.x.toFixed(1)}`}>
														{dots === "glow" ? <Circle cx={point.x} cy={point.y} r={radius * 2} fill={color} opacity={GLOW_OPACITY} /> : null}
														<Circle cx={point.x} cy={point.y} r={radius} fill={color} stroke={palette.surface} strokeWidth={2} />
													</G>
												);
											})}
										</G>
									);
								})}
							</Svg>
						)}
					</View>
					<CategoryLabels labels={data.map((datum): string => formatCategory(datum.label))} styles={labelStyles} />
					{data.map((datum, index): React.JSX.Element => (
						<CategoryTarget
							key={`${datum.label}-${String(index)}`}
							index={index}
							label={describeChartDatum(datum, series, formatValue)}
							selected={selected === index}
							style={targetStyles.at(index) ?? EMPTY_STYLE}
							onSelect={select}
						/>
					))}
				</View>
				{showLegend ? <ChartLegend items={legendItemsOf(series)} /> : null}
			</View>
		);
	}),
);

/** An area's fill when the series sets none: its colour fading downward. */
const SOFT_GRADIENT: ChartFill = { kind: "gradient", tone: "soft" };

// ── Pies and donuts ───────────────────────────────────────────────────────

/** One slice of a pie. */
export interface ChartSliceDatum {
	readonly key: string;
	readonly label: string;
	readonly value: number;
	readonly color: ChartColor;
	readonly fill?: ChartFill | undefined;
}

export interface PieChartProps {
	readonly slices: readonly ChartSliceDatum[];
	readonly accessibilityLabel: string;
	/** The hole: none (a pie), or a donut's `sm` / `md` / `lg` hole. Default `md`. */
	readonly hole?: "none" | "sm" | "md" | "lg" | undefined;
	/** A gap of the background between slices. Default `true`. */
	readonly padded?: boolean | undefined;
	/** In the hole: a total, a share. */
	readonly center?: React.ReactNode | undefined;
	/** A legend under the chart; its entries select slices. Default `true`. */
	readonly legend?: boolean | undefined;
	readonly formatValue?: ValueFormatter | undefined;
	/** The active slice, which stands out from the ring, controlled. */
	readonly activeKey?: string | null | undefined;
	readonly onActiveKeyChange?: ((key: string | null) => void) | undefined;
	readonly size?: ChartSize | undefined;
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

const HOLE_RATIOS = { none: 0, sm: 0.45, md: 0.6, lg: 0.72 };
/** The gap between slices, in radians, and its width in points. */
const SLICE_PAD = 0.04;
const SLICE_GAP = 3;
/** How far the active slice reaches past the ring, in points. */
const ACTIVE_GROWTH = 6;

export const PieChart = React.memo(
	React.forwardRef<ViewInstance, PieChartProps>(function PieChart(
		{
			slices,
			accessibilityLabel,
			hole = "md",
			padded = true,
			center,
			legend = true,
			formatValue = defaultFormat,
			activeKey,
			onActiveKeyChange,
			size = "md",
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const palette = useChartPalette();
		const chartId = useChartId();
		const [width, handleLayout] = useMeasuredWidth();
		const [ownActive, setOwnActive] = React.useState<string | null>(null);
		const active = activeKey === undefined ? ownActive : activeKey;
		const toggle = React.useCallback(
			(key: string): void => {
				const next = active === key ? null : key;
				setOwnActive(next);
				onActiveKeyChange?.(next);
			},
			[active, onActiveKeyChange],
		);
		const angles = pieSlices(
			slices.map((slice): number => slice.value),
			padded ? SLICE_PAD : 0,
		);
		const outer = width / 2 - ACTIVE_GROWTH;
		const inner = outer * HOLE_RATIOS[hole];
		const items = React.useMemo(
			(): ChartLegendItem[] => slices.map((slice): ChartLegendItem => ({ key: slice.key, label: slice.label, color: slice.color, value: formatValue(slice.value) })),
			[formatValue, slices],
		);
		const description = `${accessibilityLabel}: ${slices.map((slice): string => `${slice.label} ${formatValue(slice.value)}`).join(", ")}`;
		return (
			<View ref={ref} testID={testID} className={cn(chartVariants(), className)}>
				<View onLayout={handleLayout} testID={plotTestId(testID)} className={chartRoundPlotVariants({ size })}>
					<View accessible accessibilityRole="image" accessibilityLabel={description} className="absolute inset-0">
						{palette === null || width <= 0 ? null : (
							<Svg width={width} height={width}>
								<Defs>
									{slices.map((slice): React.JSX.Element => (
										<FillDefinition key={slice.key} id={fillId(chartId, slice.key)} fill={slice.fill} color={palette.series[slice.color]} />
									))}
								</Defs>
								{slices.map((slice, index): React.JSX.Element | null => {
									const angle = angles.at(index);
									if (angle === undefined || angle.end <= angle.start) {
										return null;
									}
									const grow = active === slice.key ? ACTIVE_GROWTH : 0;
									return (
										<SliceShape
											key={slice.key}
											sliceKey={slice.key}
											d={arcPath(width / 2, width / 2, inner, outer + grow, angle.start, angle.end)}
											fill={fillValue(slice.fill, chartId, slice.key, palette.series[slice.color])}
											stroke={padded ? palette.surface : NO_STROKE}
											dimmed={active === null ? false : active !== slice.key}
											onPress={toggle}
										/>
									);
								})}
							</Svg>
						)}
					</View>
					{center === undefined ? null : (
						<View pointerEvents="none" className="absolute inset-0 items-center justify-center">
							{center}
						</View>
					)}
				</View>
				{legend ? <ChartLegend items={items} onItemPress={toggle} activeKey={active} /> : null}
			</View>
		);
	}),
);

/** A slice's path: a tap makes it the active one. */
const SliceShape = React.memo(function SliceShape({
	sliceKey,
	d,
	fill,
	stroke,
	dimmed,
	onPress,
}: {
	readonly sliceKey: string;
	readonly d: string;
	readonly fill: string;
	readonly stroke: string;
	readonly dimmed: boolean;
	readonly onPress: (key: string) => void;
}): React.JSX.Element {
	const handlePress = React.useCallback((): void => {
		onPress(sliceKey);
	}, [onPress, sliceKey]);
	return <Path d={d} fill={fill} stroke={stroke} strokeWidth={stroke === NO_STROKE ? 0 : SLICE_GAP} opacity={dimmed ? DIMMED : 1} onPress={handlePress} />;
});

// ── Radar ─────────────────────────────────────────────────────────────────

/** A radar's one shape: its name, colour, fill and stroke. */
export type ChartRadarSeries = Omit<ChartSeries, "key" | "kind" | "outline" | "dashed">;

/** One axis of a radar, and its value. */
export interface ChartAxisDatum {
	readonly label: string;
	readonly value: number;
}

export interface RadarChartProps {
	readonly data: readonly ChartAxisDatum[];
	/** The shape's name, colour and fill (default a soft gradient). */
	readonly series: ChartRadarSeries;
	readonly accessibilityLabel: string;
	/** The scale's top. Default: the largest value, rounded up. */
	readonly max?: number | undefined;
	/** A dot on each corner: `solid`, `hollow`, or none. Default `solid`. */
	readonly dots?: "none" | "solid" | "hollow" | undefined;
	/** A soft halo around the outline. */
	readonly glow?: boolean | undefined;
	readonly formatValue?: ValueFormatter | undefined;
	readonly size?: ChartSize | undefined;
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** The rings of a radar's grid. */
const RADAR_RINGS = 4;
/** Room around a radar for its axis labels, in points; a label's box (the `w-20` class) and its line height. */
const RADAR_MARGIN = 28;
const AXIS_LABEL_WIDTH = 80;
const AXIS_LABEL_HEIGHT = 16;
const RADAR_KEY = "radar";

export const RadarChart = React.memo(
	React.forwardRef<ViewInstance, RadarChartProps>(function RadarChart(
		{ data, series, accessibilityLabel, max, dots = "solid", glow = false, formatValue = defaultFormat, size = "md", className, testID },
		ref,
	): React.JSX.Element {
		const palette = useChartPalette();
		const chartId = useChartId();
		const [width, handleLayout] = useMeasuredWidth();
		const top = max ?? niceScale(Math.max(0, ...data.map((datum): number => datum.value))).top;
		const centre = width / 2;
		const radius = Math.max(0, centre - RADAR_MARGIN);
		const corners = radarPoints(
			centre,
			centre,
			radius,
			data.map((datum): number => datum.value),
			top,
		);
		const spokes = radarPoints(
			centre,
			centre,
			radius,
			data.map((): number => top),
			top,
		);
		const labelStyles = radarPoints(
			centre,
			centre,
			radius + RADAR_MARGIN / 2,
			data.map((): number => top),
			top,
		).map((point): ViewStyle => ({ left: point.x - AXIS_LABEL_WIDTH / 2, top: point.y - AXIS_LABEL_HEIGHT / 2, width: AXIS_LABEL_WIDTH }));
		const description = `${accessibilityLabel}: ${data.map((datum): string => `${datum.label} ${formatValue(datum.value)}`).join(", ")}`;
		const strokeWidth = STROKE_WIDTHS[series.stroke ?? "regular"];
		return (
			<View ref={ref} testID={testID} className={cn(chartVariants(), className)}>
				<View onLayout={handleLayout} testID={plotTestId(testID)} className={chartRoundPlotVariants({ size })}>
					<View accessible accessibilityRole="image" accessibilityLabel={description} className="absolute inset-0">
						{palette === null || width <= 0 ? null : (
							<Svg width={width} height={width}>
								<Defs>
									<FillDefinition id={fillId(chartId, RADAR_KEY)} fill={series.fill ?? SOFT_GRADIENT} color={palette.series[series.color]} />
								</Defs>
								{Array.from({ length: RADAR_RINGS }, (_, ring): React.JSX.Element => {
									const ringPoints = radarPoints(
										centre,
										centre,
										(radius * (ring + 1)) / RADAR_RINGS,
										data.map((): number => top),
										top,
									);
									return <Path key={`ring-${String(ring)}`} d={polygonPath(ringPoints)} fill="none" stroke={palette.grid} strokeWidth={1} strokeDasharray={GRID_DASH} />;
								})}
								{spokes.map((point, index): React.JSX.Element => (
									<Line
										key={data.at(index)?.label ?? `spoke-${point.x.toFixed(1)}`}
										x1={centre}
										y1={centre}
										x2={point.x}
										y2={point.y}
										stroke={palette.grid}
										strokeWidth={1}
										strokeDasharray={GRID_DASH}
									/>
								))}
								{glow ? (
									<Path
										d={polygonPath(corners)}
										fill="none"
										stroke={palette.series[series.color]}
										strokeWidth={strokeWidth * GLOW_SPREAD}
										strokeOpacity={GLOW_OPACITY}
										strokeLinejoin="round"
									/>
								) : null}
								<Path
									d={polygonPath(corners)}
									fill={fillValue(series.fill ?? SOFT_GRADIENT, chartId, RADAR_KEY, palette.series[series.color])}
									stroke={palette.series[series.color]}
									strokeWidth={strokeWidth}
									strokeLinejoin="round"
								/>
								{dots === "none"
									? null
									: corners.map((point, index): React.JSX.Element => (
											<Circle
												key={data.at(index)?.label ?? `corner-${point.x.toFixed(1)}`}
												cx={point.x}
												cy={point.y}
												r={POINT_RADIUS}
												fill={dots === "hollow" ? palette.surface : palette.series[series.color]}
												stroke={palette.series[series.color]}
												strokeWidth={dots === "hollow" ? 2 : 0}
											/>
										))}
							</Svg>
						)}
					</View>
					<CategoryLabels labels={data.map((datum): string => datum.label)} styles={labelStyles} />
				</View>
			</View>
		);
	}),
);

// ── Radial bars ───────────────────────────────────────────────────────────

export interface RadialBarChartProps {
	/** One ring per bar, the first innermost. */
	readonly bars: readonly ChartSliceDatum[];
	readonly accessibilityLabel: string;
	/** The value of a full ring. */
	readonly max: number;
	/** A legend with each bar's value. Default `true`. */
	readonly legend?: boolean | undefined;
	readonly formatValue?: ValueFormatter | undefined;
	readonly size?: ChartSize | undefined;
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** Where the innermost ring starts, as a share of the radius, and the gap between rings (a share of a ring). */
const RADIAL_HOLE = 0.3;
const RADIAL_GAP = 0.25;

export const RadialBarChart = React.memo(
	React.forwardRef<ViewInstance, RadialBarChartProps>(function RadialBarChart(
		{ bars, accessibilityLabel, max, legend = true, formatValue = defaultFormat, size = "md", className, testID },
		ref,
	): React.JSX.Element {
		const palette = useChartPalette();
		const chartId = useChartId();
		const [width, handleLayout] = useMeasuredWidth();
		const centre = width / 2;
		const span = centre * (1 - RADIAL_HOLE);
		const ring = span / Math.max(bars.length, 1);
		const thickness = ring * (1 - RADIAL_GAP);
		const items = React.useMemo(
			(): ChartLegendItem[] => bars.map((bar): ChartLegendItem => ({ key: bar.key, label: bar.label, color: bar.color, value: formatValue(bar.value) })),
			[bars, formatValue],
		);
		const description = `${accessibilityLabel}: ${bars.map((bar): string => `${bar.label} ${formatValue(bar.value)}`).join(", ")}`;
		return (
			<View ref={ref} testID={testID} className={cn(chartVariants(), className)}>
				<View onLayout={handleLayout} testID={plotTestId(testID)} className={chartRoundPlotVariants({ size })}>
					<View accessible accessibilityRole="image" accessibilityLabel={description} className="absolute inset-0">
						{palette === null || width <= 0 ? null : (
							<Svg width={width} height={width}>
								<Defs>
									{bars.map((bar): React.JSX.Element => (
										<FillDefinition key={bar.key} id={fillId(chartId, bar.key)} fill={bar.fill} color={palette.series[bar.color]} />
									))}
								</Defs>
								{bars.map((bar, index): React.JSX.Element => {
									const inner = centre * RADIAL_HOLE + ring * index;
									const outer = inner + thickness;
									const middle = (inner + outer) / 2;
									const sweep = radialSweep(bar.value, max);
									const end = polarPoint(centre, centre, middle, sweep);
									const start = polarPoint(centre, centre, middle, 0);
									return (
										<G key={bar.key}>
											<Circle cx={centre} cy={centre} r={middle} fill="none" stroke={palette.track} strokeWidth={thickness} />
											<Path d={arcPath(centre, centre, inner, outer, 0, sweep)} fill={fillValue(bar.fill, chartId, bar.key, palette.series[bar.color])} />
											<Circle cx={start.x} cy={start.y} r={thickness / 2} fill={palette.series[bar.color]} />
											<Circle cx={end.x} cy={end.y} r={thickness / 2} fill={palette.series[bar.color]} />
										</G>
									);
								})}
							</Svg>
						)}
					</View>
				</View>
				{legend ? <ChartLegend items={items} /> : null}
			</View>
		);
	}),
);
