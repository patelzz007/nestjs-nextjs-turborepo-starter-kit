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
	{ key: "desktop", label: "Desktop", color: "chart-1", fill: { kind: "stripes" }, outline: true },
	{ key: "mobile", label: "Mobile", color: "chart-2", outline: true },
];

const TREND: ChartTrend = { label: "-15%", tone: "destructive" };

// Striped bars beside solid ones: texture, not colour alone, tells the series apart.
export function Chart5Example(): React.JSX.Element {
	return (
		<ChartCard title="User Acquisition" trend={TREND} description="Quarterly user growth tracking">
			<BarChart data={DATA} series={SERIES} accessibilityLabel="User acquisition by month" formatValue={formatUsd} />
		</ChartCard>
	);
}
