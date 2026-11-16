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

const SERIES: readonly ChartSeries[] = [{ key: "desktop", label: "Desktop", color: "chart-2", fill: { kind: "dots" }, outline: true }];

const TREND: ChartTrend = { label: "+8%", tone: "success" };

// Bars textured with a fine grid of dots over a faint tint.
export function Chart4Example(): React.JSX.Element {
	return (
		<ChartCard title="Website Traffic" trend={TREND} description="Monthly visitor behavior patterns">
			<BarChart data={DATA} series={SERIES} accessibilityLabel="Website traffic by month" formatValue={formatUsd} />
		</ChartCard>
	);
}
