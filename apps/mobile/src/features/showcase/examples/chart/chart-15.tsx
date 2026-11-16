import { AreaChart, type ChartSeries } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { abbreviateMonth, ChartCard, chartDataOf, type ChartTrend, formatCount } from "./chart-sample";

const DATA = chartDataOf(
	[
		{ month: "January", connections: 48 },
		{ month: "February", connections: 62 },
		{ month: "March", connections: 62 },
		{ month: "April", connections: 85 },
		{ month: "May", connections: 85 },
		{ month: "June", connections: 110 },
		{ month: "July", connections: 110 },
		{ month: "August", connections: 135 },
	],
	"month",
);

const SERIES: readonly ChartSeries[] = [{ key: "connections", label: "Connections", color: "chart-2", fill: { kind: "dots" } }];

const TREND: ChartTrend = { label: "+257%", tone: "success" };

// A stepped area that holds each month flat until the next, filled with dots.
export function Chart15Example(): React.JSX.Element {
	return (
		<ChartCard title="Active Connections" trend={TREND} description="Server connection pool over time">
			<AreaChart data={DATA} series={SERIES} accessibilityLabel="Active connections by month" formatCategory={abbreviateMonth} formatValue={formatCount} curve="step" />
		</ChartCard>
	);
}
