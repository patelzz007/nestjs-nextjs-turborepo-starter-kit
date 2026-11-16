import { BarChart, type ChartSeries } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { ChartCard, chartDataOf, type ChartTrend, formatUsd } from "./chart-sample";

const DATA = chartDataOf(
	[
		{ month: "Jan", desktop: 340 },
		{ month: "Feb", desktop: 600 },
		{ month: "Mar", desktop: 510 },
		{ month: "Apr", desktop: 620 },
		{ month: "May", desktop: 450 },
		{ month: "Jun", desktop: 780 },
		{ month: "Jul", desktop: 390 },
		{ month: "Aug", desktop: 920 },
		{ month: "Sep", desktop: 640 },
		{ month: "Oct", desktop: 530 },
		{ month: "Nov", desktop: 800 },
		{ month: "Dec", desktop: 270 },
	],
	"month",
);

const SERIES: readonly ChartSeries[] = [{ key: "desktop", label: "Desktop", color: "chart-1", fill: { kind: "gradient", tone: "deep" } }];

const TREND: ChartTrend = { label: "+15.7%", tone: "success" };

// Bars as 3D blocks: a gradient front with shaded top and side faces.
export function Chart6Example(): React.JSX.Element {
	return (
		<ChartCard title="Regional Performance" trend={TREND} description="Global sales distribution by region">
			<BarChart data={DATA} series={SERIES} accessibilityLabel="Regional sales by month" formatValue={formatUsd} shape="block" grid="none" />
		</ChartCard>
	);
}
