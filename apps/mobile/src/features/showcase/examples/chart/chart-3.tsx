import { BarChart, type ChartSeries } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { ChartCard, chartDataOf, type ChartTrend, formatUsd } from "./chart-sample";

const DATA = chartDataOf(
	[
		{ month: "Jan", desktop: 300 },
		{ month: "Feb", desktop: 550 },
		{ month: "Mar", desktop: 400 },
		{ month: "Apr", desktop: 630 },
		{ month: "May", desktop: 460 },
		{ month: "Jun", desktop: 780 },
		{ month: "Jul", desktop: 390 },
		{ month: "Aug", desktop: 925 },
		{ month: "Sep", desktop: 645 },
		{ month: "Oct", desktop: 530 },
		{ month: "Nov", desktop: 700 },
		{ month: "Dec", desktop: 270 },
	],
	"month",
);

const SERIES: readonly ChartSeries[] = [{ key: "desktop", label: "Desktop", color: "chart-1", fill: { kind: "stripes" }, outline: true }];

const TREND: ChartTrend = { label: "+4.3%", tone: "destructive" };

// Bars hatched with diagonal stripes on a faint tint, outlined in the series colour.
export function Chart3Example(): React.JSX.Element {
	return (
		<ChartCard title="Product Sales" trend={TREND} description="Annual sales trend visualization">
			<BarChart data={DATA} series={SERIES} accessibilityLabel="Product sales by month" formatValue={formatUsd} />
		</ChartCard>
	);
}
