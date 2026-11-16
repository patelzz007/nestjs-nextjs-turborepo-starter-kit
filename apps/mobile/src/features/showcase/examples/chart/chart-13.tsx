import { AreaChart, type ChartSeries } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { abbreviateMonth, ChartCard, chartDataOf, type ChartTrend, formatCount } from "./chart-sample";

const DATA = chartDataOf(
	[
		{ month: "January", visitors: 2400 },
		{ month: "February", visitors: 2850 },
		{ month: "March", visitors: 2600 },
		{ month: "April", visitors: 3100 },
		{ month: "May", visitors: 2900 },
		{ month: "June", visitors: 3400 },
	],
	"month",
);

const SERIES: readonly ChartSeries[] = [{ key: "visitors", label: "Visitors", color: "chart-1", fill: { kind: "gradient", tone: "soft" } }];

const TREND: ChartTrend = { label: "+24.5%", tone: "success" };

// A smooth area fading under its line, over a dashed grid.
export function Chart13Example(): React.JSX.Element {
	return (
		<ChartCard title="Website Traffic" trend={TREND} description="Monthly unique visitor trends">
			<AreaChart data={DATA} series={SERIES} accessibilityLabel="Unique visitors by month" formatCategory={abbreviateMonth} formatValue={formatCount} grid="dashed" />
		</ChartCard>
	);
}
