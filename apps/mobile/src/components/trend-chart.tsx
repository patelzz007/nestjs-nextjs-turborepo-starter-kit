// A value over time: one or two series as smooth lines on one y-axis (never
// two), a wash under a lone series, hairline gridlines with round ticks, and
// the first, middle and last bucket under the plot. The tick values sit in
// their own column left of the plot, each centred on its gridline: the data
// is drawn only in the plot, so a line can never run through a label. Touch the plot and drag to
// read any bucket: a scrub line and dots mark it, and the readout above the
// plot names it with each series' value — the chart's tooltip, placed where a
// finger never covers it. The selection stays after the finger lifts.
//
// Screen readers get the same through the "adjustable" role: swipe up or down
// to step through the buckets, each announced with its values. Two series get
// a legend (identity never by colour alone).
//
// Presentational and data-agnostic: the caller passes the values, every label
// and the formatters. Colours are the chart tokens (chart-colors.ts).

import * as React from "react";
import { StyleSheet, Text, View, type AccessibilityActionEvent, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import { Circle, Line, Path } from "react-native-svg";

import { areaPath, linePath, nearestIndex, niceTicks, pointsOf, scaleTop, yOf, type ChartPoint, type PlotSize } from "../lib/chart-geometry";
import { playSelectionFeedback } from "../lib/haptics";
import { CHART_COLOR_CLASSES, type ChartColor } from "./chart-colors";
import { SvgLayer } from "./svg-layer";

export interface TrendSeries {
	/** Stable identity of the series. */
	readonly key: string;
	/** Named in the legend and the readout. */
	readonly label: string;
	readonly color: ChartColor;
	/** One value per bucket, in bucket order. */
	readonly values: readonly number[];
}

export interface TrendChartProps {
	/** What the chart shows ("Spending over time"): its accessible name. */
	readonly title: string;
	/** One or two series over the same buckets. */
	readonly series: readonly TrendSeries[];
	/** Each bucket in full ("Sat, 4 Oct"): the readout and screen readers. */
	readonly bucketLabels: readonly string[];
	/** Each bucket short ("4 Oct"): under the plot. */
	readonly tickLabels: readonly string[];
	/** A value in the readout ("RM 120.00"). */
	readonly formatValue: (value: number) => string;
	/** A y-axis tick ("RM 100"). */
	readonly formatTick: (value: number) => string;
	/** Shown in the readout until a bucket is picked ("Touch the chart to see each day"). */
	readonly hint: string;
	readonly testID?: string;
}

/** Height of the plot, in points. */
const PLOT_HEIGHT = 168;
/** Gridline intervals: three keeps the labels clear of each other on a phone. */
const TICK_INTERVALS = 3;
/** Height of a tick label's row (one line of `text-xs`). */
const TICK_LABEL_HEIGHT = 16;
/**
 * Room above the top gridline and under the bottom one: half a tick label, so
 * the label column (its rows spread from top to bottom) centres each label on
 * its gridline — the ticks are evenly spaced, and so are the rows. It also
 * clears the ring of a dot on the top gridline.
 */
const PLOT_TOP_INSET = TICK_LABEL_HEIGHT / 2;
const PLOT_BOTTOM_INSET = TICK_LABEL_HEIGHT / 2;
/** Room left and right, so the end dots are not clipped. */
const PLOT_SIDE_INSET = 6;

/** Mark specs (rules: thin marks, ≥ 8 pt dots with a 2 pt surface ring). */
const LINE_WIDTH = 2;
const GRID_WIDTH = 1;
const DOT_RADIUS = 4;
const RING_RADIUS = DOT_RADIUS + 2;
/** The wash under a lone series: the series hue, faint. */
const AREA_OPACITY = 0.12;

const NO_SELECTION = null;

const styles = StyleSheet.create({
	plot: { height: PLOT_HEIGHT },
	tickLabel: { height: TICK_LABEL_HEIGHT },
});

/** The screen reader's swipe-up / swipe-down steps. */
const ADJUSTABLE_ACTIONS = [{ name: "increment" }, { name: "decrement" }];

/** Where the plot draws inside its box: the data never touches an edge. */
interface PlotFrame {
	readonly size: PlotSize;
	readonly offsetX: number;
	readonly offsetY: number;
}

function plotFrameOf(width: number): PlotFrame {
	return {
		size: { width: Math.max(0, width - 2 * PLOT_SIDE_INSET), height: PLOT_HEIGHT - PLOT_TOP_INSET - PLOT_BOTTOM_INSET },
		offsetX: PLOT_SIDE_INSET,
		offsetY: PLOT_TOP_INSET,
	};
}

function framed(points: readonly ChartPoint[], frame: PlotFrame): readonly ChartPoint[] {
	return points.map((point: ChartPoint): ChartPoint => ({ x: point.x + frame.offsetX, y: point.y + frame.offsetY }));
}

/** The highest value of any series. */
function maxOf(series: readonly TrendSeries[]): number {
	return Math.max(0, ...series.flatMap((item: TrendSeries): readonly number[] => item.values));
}

/** "Sat, 4 Oct: Claimed 3, Redeemed 2". */
function describeBucket(series: readonly TrendSeries[], index: number, bucketLabel: string, formatValue: (value: number) => string): string {
	const values = series.map((item: TrendSeries): string => `${item.label} ${formatValue(item.values.at(index) ?? 0)}`);
	return `${bucketLabel}: ${values.join(", ")}`;
}

export function TrendChart({ title, series, bucketLabels, tickLabels, formatValue, formatTick, hint, testID }: TrendChartProps): React.JSX.Element {
	const [width, setWidth] = React.useState(0);
	const [picked, setPicked] = React.useState<number | null>(NO_SELECTION);
	const count = bucketLabels.length;
	// A pick from a longer range does not carry over to a shorter one.
	const selected = picked !== null && picked < count ? picked : NO_SELECTION;

	const measure = React.useCallback((event: LayoutChangeEvent): void => {
		setWidth(event.nativeEvent.layout.width);
	}, []);

	const frame = plotFrameOf(width);
	const ticks = niceTicks(maxOf(series), TICK_INTERVALS);
	const top = scaleTop(ticks);

	const select = React.useCallback(
		(index: number): void => {
			if (index !== selected) {
				playSelectionFeedback();
				setPicked(index);
			}
		},
		[selected],
	);

	const selectAt = React.useCallback(
		(event: GestureResponderEvent): void => {
			select(nearestIndex(event.nativeEvent.locationX - frame.offsetX, count, frame.size.width));
		},
		[count, frame.offsetX, frame.size.width, select],
	);

	const step = React.useCallback(
		(event: AccessibilityActionEvent): void => {
			const delta = event.nativeEvent.actionName === "increment" ? 1 : -1;
			const start = selected ?? (delta > 0 ? -1 : count);
			select(Math.min(count - 1, Math.max(0, start + delta)));
		},
		[count, select, selected],
	);

	const claimTouch = React.useCallback((): boolean => true, []);
	const keepTouch = React.useCallback((): boolean => false, []);

	const readout = selected === NO_SELECTION ? null : describeBucket(series, selected, bucketLabels.at(selected) ?? "", formatValue);
	const seriesPoints = series.map((item: TrendSeries): readonly ChartPoint[] => framed(pointsOf(item.values, top, frame.size), frame));
	const baselineY = frame.offsetY + frame.size.height;

	return (
		<View className="gap-3" testID={testID}>
			<Readout
				series={series}
				selected={selected}
				bucketLabel={selected === NO_SELECTION ? null : (bucketLabels.at(selected) ?? null)}
				formatValue={formatValue}
				hint={hint}
			/>
			<View className="flex-row gap-2">
				<TickLabels labels={[...ticks].reverse().map(formatTick)} />
				<View className="flex-1 gap-3">
					<View style={styles.plot} className="w-full" onLayout={measure} testID={testID === undefined ? undefined : `${testID}-frame`}>
						{width > 0 ? (
							<>
								<SvgLayer width={width} height={PLOT_HEIGHT} colorClassName="accent-border">
									{ticks.map((tick: number): React.JSX.Element => {
										const y = frame.offsetY + yOf(tick, top, frame.size.height);
										return <Line key={tick} x1={0} x2={width} y1={y} y2={y} stroke="currentColor" strokeWidth={GRID_WIDTH} />;
									})}
								</SvgLayer>
								{series.map((item: TrendSeries, index: number): React.JSX.Element => {
									const points = seriesPoints.at(index) ?? [];
									return (
										<SvgLayer
											key={item.key}
											width={width}
											height={PLOT_HEIGHT}
											colorClassName={CHART_COLOR_CLASSES[item.color].accent}
											{...(testID === undefined ? {} : { testID: `${testID}-${item.key}` })}>
											{series.length === 1 ? <Path d={areaPath(points, baselineY)} fill="currentColor" fillOpacity={AREA_OPACITY} /> : null}
											<Path d={linePath(points)} fill="none" stroke="currentColor" strokeWidth={LINE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
										</SvgLayer>
									);
								})}
								{selected === NO_SELECTION ? null : <Selection series={series} seriesPoints={seriesPoints} selected={selected} width={width} baselineY={baselineY} />}
							</>
						) : null}
						<View
							accessible
							accessibilityRole="adjustable"
							accessibilityLabel={title}
							accessibilityHint="Swipe up or down to step through the values"
							accessibilityValue={{ text: readout ?? hint }}
							accessibilityActions={ADJUSTABLE_ACTIONS}
							onAccessibilityAction={step}
							onStartShouldSetResponder={claimTouch}
							onMoveShouldSetResponder={claimTouch}
							onResponderTerminationRequest={keepTouch}
							onResponderGrant={selectAt}
							onResponderMove={selectAt}
							className="absolute inset-0"
							testID={testID === undefined ? undefined : `${testID}-plot`}
						/>
					</View>
					<AxisLabels tickLabels={tickLabels} />
				</View>
			</View>
			{series.length > 1 ? <Legend series={series} /> : null}
		</View>
	);
}

interface ReadoutProps {
	readonly series: readonly TrendSeries[];
	readonly selected: number | null;
	readonly bucketLabel: string | null;
	readonly formatValue: (value: number) => string;
	readonly hint: string;
}

/** The picked bucket and each series' value there, or the hint. One fixed height, so nothing moves. */
function Readout({ series, selected, bucketLabel, formatValue, hint }: ReadoutProps): React.JSX.Element {
	if (selected === null || bucketLabel === null) {
		return (
			<View className="min-h-11 justify-center">
				<Text className="font-sans text-sm text-muted-foreground">{hint}</Text>
			</View>
		);
	}
	return (
		<View className="min-h-11 justify-center gap-0.5" importantForAccessibility="no-hide-descendants">
			<Text className="font-sans-medium text-xs text-muted-foreground">{bucketLabel}</Text>
			<View className="flex-row flex-wrap gap-x-4 gap-y-0.5">
				{series.map((item: TrendSeries): React.JSX.Element => (
					<View key={item.key} className="flex-row items-center gap-1.5">
						{series.length > 1 ? <View className={`h-0.5 w-3 rounded-full ${CHART_COLOR_CLASSES[item.color].fill}`} /> : null}
						<Text className="font-sans-semibold text-base text-foreground">{formatValue(item.values.at(selected) ?? 0)}</Text>
						{series.length > 1 ? <Text className="font-sans text-sm text-muted-foreground">{item.label}</Text> : null}
					</View>
				))}
			</View>
		</View>
	);
}

interface SelectionProps {
	readonly series: readonly TrendSeries[];
	readonly seriesPoints: readonly (readonly ChartPoint[])[];
	readonly selected: number;
	readonly width: number;
	readonly baselineY: number;
}

/** The scrub line, and a ringed dot on every series at the picked bucket. */
function Selection({ series, seriesPoints, selected, width, baselineY }: SelectionProps): React.JSX.Element {
	const points = seriesPoints.map((points: readonly ChartPoint[]): ChartPoint | undefined => points.at(selected));
	const x = points.find((point: ChartPoint | undefined): boolean => point !== undefined)?.x ?? 0;
	return (
		<>
			<SvgLayer width={width} height={PLOT_HEIGHT} colorClassName="accent-muted-foreground">
				<Line x1={x} x2={x} y1={PLOT_TOP_INSET} y2={baselineY} stroke="currentColor" strokeWidth={GRID_WIDTH} />
			</SvgLayer>
			{series.map((item: TrendSeries, index: number): React.JSX.Element | null => {
				const point = points.at(index);
				return point === undefined ? null : (
					<React.Fragment key={item.key}>
						<SvgLayer width={width} height={PLOT_HEIGHT} colorClassName="accent-card">
							<Circle cx={point.x} cy={point.y} r={RING_RADIUS} fill="currentColor" />
						</SvgLayer>
						<SvgLayer width={width} height={PLOT_HEIGHT} colorClassName={CHART_COLOR_CLASSES[item.color].accent}>
							<Circle cx={point.x} cy={point.y} r={DOT_RADIUS} fill="currentColor" />
						</SvgLayer>
					</React.Fragment>
				);
			})}
		</>
	);
}

interface TickLabelsProps {
	/** Top tick first. */
	readonly labels: readonly string[];
}

/**
 * The y-axis values beside the plot, as wide as the widest: a column as tall
 * as the plot, its rows spread from top to bottom, each centred on its gridline.
 */
function TickLabels({ labels }: TickLabelsProps): React.JSX.Element {
	return (
		<View style={styles.plot} className="justify-between" importantForAccessibility="no-hide-descendants">
			{labels.map((label: string, position: number): React.JSX.Element => (
				<View key={`${String(position)}-${label}`} style={styles.tickLabel} className="justify-center">
					<Text className="text-right font-sans text-xs text-muted-foreground tabular-nums">{label}</Text>
				</View>
			))}
		</View>
	);
}

interface AxisLabelsProps {
	readonly tickLabels: readonly string[];
}

/** Buckets named under the plot: the first, the middle and the last. */
const AXIS_LABELS_SHOWN = 3;

/** Enough labels to place the range without crowding a phone; a short range shows every one. */
export function axisLabelsOf(tickLabels: readonly string[]): readonly string[] {
	if (tickLabels.length <= AXIS_LABELS_SHOWN) {
		return tickLabels;
	}
	return [tickLabels.at(0), tickLabels.at(Math.floor((tickLabels.length - 1) / 2)), tickLabels.at(-1)].flatMap((label: string | undefined): string[] =>
		label === undefined ? [] : [label],
	);
}

function AxisLabels({ tickLabels }: AxisLabelsProps): React.JSX.Element {
	const shown = axisLabelsOf(tickLabels);
	return (
		<View className="flex-row justify-between" importantForAccessibility="no-hide-descendants">
			{shown.map((label: string, position: number): React.JSX.Element => (
				<Text key={`${String(position)}-${label}`} className="font-sans text-xs text-muted-foreground">
					{label}
				</Text>
			))}
		</View>
	);
}

interface LegendProps {
	readonly series: readonly TrendSeries[];
}

/** Each series' line key and name. */
function Legend({ series }: LegendProps): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap gap-x-4 gap-y-1" accessible accessibilityLabel={`Legend: ${series.map((item: TrendSeries): string => item.label).join(", ")}`}>
			{series.map((item: TrendSeries): React.JSX.Element => (
				<View key={item.key} className="flex-row items-center gap-1.5">
					<View className={`h-0.5 w-3 rounded-full ${CHART_COLOR_CLASSES[item.color].fill}`} />
					<Text className="font-sans text-sm text-muted-foreground">{item.label}</Text>
				</View>
			))}
		</View>
	);
}
