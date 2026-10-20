"use client";

import { ChartStateFrame, CHART_LOADING, DEFAULT_CHART_FRAME_HEIGHT, type ChartFrameHeight } from "@workspace/ui/components/analytics-panel";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import type { TimeSeriesChart, TimeSeriesChartProps } from "@workspace/ui/components/time-series-chart";
import { cn } from "@workspace/ui/lib/core/utils";
import dynamic from "next/dynamic";
import * as React from "react";

/** What the skeleton needs from the chart's props: `next/dynamic` hands its `loading` fallback none, so they travel by context. */
interface TimeSeriesChartSkeletonShape {
	readonly height: ChartFrameHeight;
	readonly hasLegend: boolean;
	readonly className: string | undefined;
}

const DEFAULT_SKELETON_SHAPE: TimeSeriesChartSkeletonShape = { height: DEFAULT_CHART_FRAME_HEIGHT, hasLegend: false, className: undefined };

const TimeSeriesChartSkeletonShapeContext = React.createContext<TimeSeriesChartSkeletonShape>(DEFAULT_SKELETON_SHAPE);

/** More than one series draws a legend above the plot. */
const LEGEND_SERIES_THRESHOLD = 1;

/**
 * The chart's frame while recharts loads — and its server output: the legend
 * row (when the chart has one), the plot at the chart's `height` (the
 * `ChartStateFrame` loading bone, the same box the chart itself uses for its
 * loading state) and the "show as table" line, laid out like the `<figure>`.
 */
function TimeSeriesChartSkeleton(): React.JSX.Element {
	const { height, hasLegend, className } = React.useContext(TimeSeriesChartSkeletonShapeContext);
	return (
		<SkeletonRegion data-slot="time-series-chart-skeleton" className={cn("flex min-w-0 flex-col gap-3", className)}>
			{hasLegend ? <Skeleton variant="text" className="h-4 w-40" /> : null}
			<ChartStateFrame state={CHART_LOADING} height={height}>
				{null}
			</ChartStateFrame>
			<Skeleton variant="text" className="h-4 w-24" />
		</SkeletonRegion>
	);
}

function renderTimeSeriesChartSkeleton(): React.JSX.Element {
	return <TimeSeriesChartSkeleton />;
}

/**
 * The chart module, behind a render prop: the loaded component stays generic
 * over the series keys, so the caller's `TKey` reaches it unchanged.
 */
interface TimeSeriesChartHostProps {
	readonly render: (chart: typeof TimeSeriesChart) => React.JSX.Element;
}

const LazyTimeSeriesChartHost = dynamic(
	() =>
		import("@workspace/ui/components/time-series-chart").then(
			(module) =>
				function TimeSeriesChartHost({ render }: TimeSeriesChartHostProps): React.JSX.Element {
					return render(module.TimeSeriesChart);
				},
		),
	{ ssr: false, loading: renderTimeSeriesChartSkeleton },
);

/**
 * `TimeSeriesChart` without recharts in the page's first bundle (decision #65):
 * the server renders a skeleton sized from the chart's `height` prop, and the
 * chart replaces it once its chunk loads. Same props, same chart.
 */
export default function TimeSeriesChartClientOnly<TKey extends string>(props: TimeSeriesChartProps<TKey>): React.JSX.Element {
	const { height = DEFAULT_CHART_FRAME_HEIGHT, series, className } = props;
	const hasLegend = series.length > LEGEND_SERIES_THRESHOLD;
	const shape = React.useMemo((): TimeSeriesChartSkeletonShape => ({ height, hasLegend, className }), [className, hasLegend, height]);
	const render = React.useCallback((Chart: typeof TimeSeriesChart): React.JSX.Element => <Chart {...props} />, [props]);
	return (
		<TimeSeriesChartSkeletonShapeContext.Provider value={shape}>
			<LazyTimeSeriesChartHost render={render} />
		</TimeSeriesChartSkeletonShapeContext.Provider>
	);
}
