import { AreaChart, type ChartSeries } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { abbreviateMonth, ChartCard, chartDataOf, type ChartTrend, formatCount } from "./chart-sample";

const DATA = chartDataOf(
	[
		{ month: "January", organic: 1200, paid: 580, referral: 320 },
		{ month: "February", organic: 1450, paid: 620, referral: 380 },
		{ month: "March", organic: 1380, paid: 540, referral: 420 },
		{ month: "April", organic: 1650, paid: 710, referral: 460 },
		{ month: "May", organic: 1520, paid: 680, referral: 390 },
		{ month: "June", organic: 1800, paid: 750, referral: 510 },
	],
	"month",
);

const SERIES: readonly ChartSeries[] = [
	{ key: "referral", label: "Referral", color: "chart-3", fill: { kind: "gradient", tone: "soft" }, stroke: "thin", dashed: true },
	{ key: "paid", label: "Paid", color: "chart-2", fill: { kind: "gradient", tone: "soft" }, stroke: "thin", dashed: true },
	{ key: "organic", label: "Organic", color: "chart-1", fill: { kind: "gradient", tone: "soft" } },
];

const TREND: ChartTrend = { label: "+18.3%", tone: "success" };

// Three channels stacked; the lower two traced with dashed strokes.
export function Chart14Example(): React.JSX.Element {
	return (
		<ChartCard title="Traffic Sources" trend={TREND} description="Visitor acquisition by channel">
			<AreaChart data={DATA} series={SERIES} accessibilityLabel="Visitors by channel and month" formatCategory={abbreviateMonth} formatValue={formatCount} stacked />
		</ChartCard>
	);
}
