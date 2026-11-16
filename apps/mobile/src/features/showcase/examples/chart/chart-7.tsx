import { BarChart, type ChartSeries } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { ChartCard, chartDataOf, type ChartTrend, formatCount } from "./chart-sample";

const DATA = chartDataOf(
	[
		{ month: "Jan", desktop: 120 },
		{ month: "Feb", desktop: 250 },
		{ month: "Mar", desktop: 200 },
		{ month: "Apr", desktop: 170 },
		{ month: "May", desktop: 209 },
		{ month: "Jun", desktop: 210 },
		{ month: "Jul", desktop: 150 },
		{ month: "Aug", desktop: 230 },
		{ month: "Sep", desktop: 180 },
		{ month: "Oct", desktop: 190 },
		{ month: "Nov", desktop: 200 },
		{ month: "Dec", desktop: 120 },
	],
	"month",
);

const SERIES: readonly ChartSeries[] = [{ key: "desktop", label: "Desktop", color: "chart-3", fill: { kind: "gradient", tone: "fade" } }];

const TREND: ChartTrend = { label: "+2.4%", tone: "success" };

// Bars fading downward from 70 to 20 percent, with no gridlines.
export function Chart7Example(): React.JSX.Element {
	return (
		<ChartCard title="Engagement Metrics" trend={TREND} description="User interaction and click-through rates">
			<BarChart data={DATA} series={SERIES} accessibilityLabel="Engagement by month" formatValue={formatCount} radius="lg" grid="none" />
		</ChartCard>
	);
}
