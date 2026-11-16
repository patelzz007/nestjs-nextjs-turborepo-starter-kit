import { BarChart, type ChartSeries } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { ChartCard, chartDataOf, type ChartTrend, formatCount } from "./chart-sample";

const DATA = chartDataOf(
	[
		{ month: "Jan", desktop: 342, mobile: 245 },
		{ month: "Feb", desktop: 876, mobile: 654 },
		{ month: "Mar", desktop: 512, mobile: 389 },
		{ month: "Apr", desktop: 629, mobile: 521 },
		{ month: "May", desktop: 458, mobile: 367 },
		{ month: "Jun", desktop: 781, mobile: 598 },
	],
	"month",
);

const SERIES: readonly ChartSeries[] = [
	{ key: "desktop", label: "Desktop", color: "chart-1" },
	{ key: "mobile", label: "Mobile", color: "chart-2" },
];

const TREND: ChartTrend = { label: "-3.2%", tone: "destructive" };

// Horizontal bars, months down the side, comparing two series.
export function Chart12Example(): React.JSX.Element {
	return (
		<ChartCard title="Inventory Levels" trend={TREND} description="Stock availability across warehouses">
			<BarChart data={DATA} series={SERIES} accessibilityLabel="Inventory by month" formatValue={formatCount} orientation="horizontal" radius="sm" />
		</ChartCard>
	);
}
