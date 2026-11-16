import { BarChart, type ChartSeries } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { ChartCard, chartDataOf, type ChartTrend, formatUsd } from "./chart-sample";

const DATA = chartDataOf(
	[
		{ month: "Jan", desktop: 300 },
		{ month: "Feb", desktop: 600 },
		{ month: "Mar", desktop: 500 },
		{ month: "Apr", desktop: 600 },
		{ month: "May", desktop: 400 },
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

const SERIES: readonly ChartSeries[] = [{ key: "desktop", label: "Desktop", color: "chart-1", fill: { kind: "gradient", tone: "duotone", direction: "right" } }];

const TREND: ChartTrend = { label: "+12.5%", tone: "success" };

// Bars split down the middle: a pale left half and a solid right half.
export function Chart10Example(): React.JSX.Element {
	return (
		<ChartCard title="Operational Efficiency" trend={TREND} description="Supply chain performance metrics">
			<BarChart data={DATA} series={SERIES} accessibilityLabel="Efficiency by month" formatValue={formatUsd} />
		</ChartCard>
	);
}
