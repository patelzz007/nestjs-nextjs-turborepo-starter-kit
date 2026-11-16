import { BarChart, type ChartSeries } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { abbreviateMonth, ChartCard, chartDataOf, type ChartTrend, formatUsd } from "./chart-sample";

const DATA = chartDataOf(
	[
		{ month: "January", desktop: 120, mobile: 80 },
		{ month: "February", desktop: 250, mobile: 200 },
		{ month: "March", desktop: 230, mobile: 120 },
		{ month: "April", desktop: 70, mobile: 190 },
		{ month: "May", desktop: 209, mobile: 130 },
		{ month: "June", desktop: 210, mobile: 140 },
	],
	"month",
);

const SERIES: readonly ChartSeries[] = [
	{ key: "desktop", label: "Desktop", color: "chart-1" },
	{ key: "mobile", label: "Mobile", color: "chart-2" },
];

const TREND: ChartTrend = { label: "+12%", tone: "warning" };

// Two series grouped side by side, each in its own colour, named in the legend.
export function Chart2Example(): React.JSX.Element {
	return (
		<ChartCard title="Market Share" trend={TREND} description="Departmental performance comparison">
			<BarChart data={DATA} series={SERIES} accessibilityLabel="Market share by month" formatCategory={abbreviateMonth} formatValue={formatUsd} />
		</ChartCard>
	);
}
