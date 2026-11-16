import { AreaChart, type ChartSeries } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { abbreviateMonth, ChartCard, chartDataOf, type ChartTrend, formatCount } from "./chart-sample";

const DATA = chartDataOf(
	[
		{ month: "January", api: 1820, webhook: 1640 },
		{ month: "February", api: 2340, webhook: 2160 },
		{ month: "March", api: 1960, webhook: 1880 },
		{ month: "April", api: 2780, webhook: 2540 },
		{ month: "May", api: 2100, webhook: 1920 },
		{ month: "June", api: 3120, webhook: 2880 },
		{ month: "July", api: 2540, webhook: 2320 },
		{ month: "August", api: 3480, webhook: 3160 },
		{ month: "September", api: 2860, webhook: 2580 },
		{ month: "October", api: 2420, webhook: 2140 },
		{ month: "November", api: 3240, webhook: 2960 },
		{ month: "December", api: 2680, webhook: 2440 },
	],
	"month",
);

const SERIES: readonly ChartSeries[] = [
	{ key: "webhook", label: "Webhooks", color: "chart-3", fill: { kind: "crosshatch" }, stroke: "thin" },
	{ key: "api", label: "API Calls", color: "chart-1", fill: { kind: "crosshatch" }, stroke: "thin" },
];

const TREND: ChartTrend = { label: "+12.8%", tone: "success" };

// Two stacked areas, each filled with a crosshatch in its own colour.
export function Chart18Example(): React.JSX.Element {
	return (
		<ChartCard title="Request Volume" trend={TREND} description="API and webhook traffic over 12 months">
			<AreaChart data={DATA} series={SERIES} accessibilityLabel="Requests by month" formatCategory={abbreviateMonth} formatValue={formatCount} stacked />
		</ChartCard>
	);
}
