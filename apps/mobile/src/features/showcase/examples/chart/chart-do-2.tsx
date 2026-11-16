import { BarChart, type ChartSeries } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { chartDataOf, formatUsd } from "./chart-sample";

const DATA = chartDataOf(
	[
		{ quarter: "Q1", revenue: 1250 },
		{ quarter: "Q2", revenue: 1840 },
		{ quarter: "Q3", revenue: 1520 },
		{ quarter: "Q4", revenue: 2210 },
	],
	"quarter",
);

const SERIES: readonly ChartSeries[] = [{ key: "revenue", label: "Revenue", color: "chart-1" }];

// A handful of categories: each bar is wide enough to tap and its label fits under it.
export function ChartDo2Example(): React.JSX.Element {
	return <BarChart data={DATA} series={SERIES} accessibilityLabel="Revenue by quarter" formatValue={formatUsd} size="sm" />;
}
