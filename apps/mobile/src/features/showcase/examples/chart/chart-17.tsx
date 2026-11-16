import { AreaChart, type ChartSeries } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { abbreviateMonth, ChartCard, chartDataOf, formatUsd } from "./chart-sample";

const DATA = chartDataOf(
	[
		{ month: "January", forecast: 2600 },
		{ month: "February", forecast: 4200 },
		{ month: "March", forecast: 2400 },
		{ month: "April", forecast: 5000 },
		{ month: "May", forecast: 2800 },
		{ month: "June", forecast: 5800 },
		{ month: "July", forecast: 3200 },
		{ month: "August", forecast: 6200 },
		{ month: "September", forecast: 3800 },
	],
	"month",
);

const SERIES: readonly ChartSeries[] = [{ key: "forecast", label: "Forecast", color: "chart-4", fill: { kind: "stripes" }, stroke: "bold" }];

// A projected line over a faintly striped zone, with its legend below.
export function Chart17Example(): React.JSX.Element {
	return (
		<ChartCard title="Sales Forecast" description="Projected sales performance with trends">
			<AreaChart data={DATA} series={SERIES} accessibilityLabel="Sales forecast by month" formatCategory={abbreviateMonth} formatValue={formatUsd} legend />
		</ChartCard>
	);
}
