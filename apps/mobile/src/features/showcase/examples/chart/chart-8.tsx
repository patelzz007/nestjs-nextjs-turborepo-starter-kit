import { BarChart, type ChartSeries } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { ChartCard, chartDataOf, type ChartTrend, formatUsd } from "./chart-sample";

const DATA = chartDataOf(
	[
		{ month: "Jan", desktop: 340 },
		{ month: "Feb", desktop: 870 },
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

const SERIES: readonly ChartSeries[] = [{ key: "desktop", label: "Desktop", color: "chart-5" }];

const TREND: ChartTrend = { label: "+8.2%", tone: "destructive" };

// Isometric blocks in one flat colour, their faces at lighter shades.
export function Chart8Example(): React.JSX.Element {
	return (
		<ChartCard title="Financial Forecast" trend={TREND} description="Projected vs actual revenue growth">
			<BarChart data={DATA} series={SERIES} accessibilityLabel="Revenue forecast by month" formatValue={formatUsd} shape="isometric" grid="none" />
		</ChartCard>
	);
}
