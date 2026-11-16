import { BarChart, type ChartSeries } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { ChartCard, chartDataOf, type ChartTrend, formatUsd } from "./chart-sample";

const DATA = chartDataOf(
	[
		{ month: "Jan", desktop: 340, mobile: 180 },
		{ month: "Feb", desktop: 870, mobile: 420 },
		{ month: "Mar", desktop: 510, mobile: 280 },
		{ month: "Apr", desktop: 620, mobile: 350 },
		{ month: "May", desktop: 450, mobile: 240 },
		{ month: "Jun", desktop: 780, mobile: 390 },
	],
	"month",
);

const SERIES: readonly ChartSeries[] = [
	{ key: "desktop", label: "Desktop", color: "chart-2", fill: { kind: "dots" }, outline: true },
	{ key: "mobile", label: "Mobile", color: "chart-2", outline: true },
];

const TREND: ChartTrend = { label: "+18.4%", tone: "success" };

// Two series in one colour, told apart by fill: dotted desktop, solid mobile.
export function Chart9Example(): React.JSX.Element {
	return (
		<ChartCard title="Customer Retention" trend={TREND} description="Customer loyalty across segments">
			<BarChart data={DATA} series={SERIES} accessibilityLabel="Customer retention by month" formatValue={formatUsd} />
		</ChartCard>
	);
}
