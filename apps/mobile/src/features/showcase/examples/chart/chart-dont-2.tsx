import { BarChart, type ChartDatum, type ChartSeries } from "@workspace/ui-native/components/chart";
import * as React from "react";

/** Two years of days, by week: far more bars than a phone's width holds. */
const WEEKS = 104;
const BASE = 900;
const SWING = 400;
const PERIOD = 7;

const DATA: readonly ChartDatum[] = Array.from({ length: WEEKS }, (_, week): ChartDatum => ({
	label: `W${String(week + 1)}`,
	values: { revenue: BASE + SWING * Math.sin(week / PERIOD) },
}));

const SERIES: readonly ChartSeries[] = [{ key: "revenue", label: "Revenue", color: "chart-1" }];

// A hundred bars on a phone: too thin to tap, their labels piled on each other.
export function ChartDont2Example(): React.JSX.Element {
	return <BarChart data={DATA} series={SERIES} accessibilityLabel="Revenue by week" size="sm" />;
}
