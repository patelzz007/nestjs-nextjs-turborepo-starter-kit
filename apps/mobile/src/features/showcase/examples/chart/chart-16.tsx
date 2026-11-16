import { AreaChart, type ChartSeries } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { ChartCard, chartDataOf, type ChartTrend, formatCount } from "./chart-sample";

const DATA = chartDataOf(
	[
		{ week: "W1", signups: 64 },
		{ week: "W2", signups: 78 },
		{ week: "W3", signups: 52 },
		{ week: "W4", signups: 92 },
		{ week: "W5", signups: 85 },
		{ week: "W6", signups: 110 },
		{ week: "W7", signups: 98 },
		{ week: "W8", signups: 125 },
	],
	"week",
);

const SERIES: readonly ChartSeries[] = [{ key: "signups", label: "Signups", color: "chart-3", fill: { kind: "gradient", tone: "soft" } }];

const TREND: ChartTrend = { label: "+144%", tone: "success" };

// A glowing line over a soft area, a glowing dot on every week.
export function Chart16Example(): React.JSX.Element {
	return (
		<ChartCard title="New Signups" trend={TREND} description="Weekly user registration trends">
			<AreaChart data={DATA} series={SERIES} accessibilityLabel="Signups by week" formatValue={formatCount} dots="glow" glow grid="none" />
		</ChartCard>
	);
}
