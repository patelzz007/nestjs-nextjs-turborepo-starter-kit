import { BarChart, type ChartSeries } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { abbreviateMonth, ChartCard, chartDataOf, type ChartTrend, formatUsd } from "./chart-sample";

const DATA = chartDataOf(
	[
		{ month: "January", desktop: 300 },
		{ month: "February", desktop: 550 },
		{ month: "March", desktop: 400 },
		{ month: "April", desktop: 630 },
		{ month: "May", desktop: 460 },
		{ month: "June", desktop: 780 },
		{ month: "July", desktop: 390 },
		{ month: "August", desktop: 925 },
		{ month: "September", desktop: 645 },
		{ month: "October", desktop: 530 },
		{ month: "November", desktop: 700 },
		{ month: "December", desktop: 270 },
	],
	"month",
);

const SERIES: readonly ChartSeries[] = [{ key: "desktop", label: "Desktop", color: "chart-1" }];

const TREND: ChartTrend = { label: "+5.2%", tone: "success" };

// One series of rounded bars; tap a month to read it.
export function Chart1Example(): React.JSX.Element {
	return (
		<ChartCard title="Revenue Growth" trend={TREND} description="Monthly revenue performance tracking">
			<BarChart data={DATA} series={SERIES} accessibilityLabel="Monthly revenue" formatCategory={abbreviateMonth} formatValue={formatUsd} />
		</ChartCard>
	);
}
