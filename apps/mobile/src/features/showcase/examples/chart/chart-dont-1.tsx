import { BarChart, type ChartDatum, type ChartSeries } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { chartDataOf } from "./chart-sample";

const DATA: readonly ChartDatum[] = chartDataOf(
	[
		{ month: "Jan", desktop: 340, mobile: 180 },
		{ month: "Feb", desktop: 870, mobile: 420 },
		{ month: "Mar", desktop: 510, mobile: 280 },
	],
	"month",
);

const SERIES: readonly ChartSeries[] = [
	{ key: "desktop", label: "Desktop", color: "chart-1" },
	{ key: "mobile", label: "Mobile", color: "chart-5" },
];

// Two series in close colours and no legend: which bar is which is left to guesswork.
export function ChartDont1Example(): React.JSX.Element {
	return <BarChart data={DATA} series={SERIES} accessibilityLabel="Visitors by device" size="sm" legend={false} />;
}
