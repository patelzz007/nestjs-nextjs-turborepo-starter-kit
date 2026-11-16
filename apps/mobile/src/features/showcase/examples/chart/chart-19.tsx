import { PieChart, type ChartSliceDatum } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { ChartCard, DonutCenter, formatCount } from "./chart-sample";

const SLICES: readonly ChartSliceDatum[] = [
	{ key: "direct", label: "Direct", value: 4200, color: "chart-1", fill: { kind: "gradient", tone: "deep" } },
	{ key: "search", label: "Search", value: 3600, color: "chart-2", fill: { kind: "gradient", tone: "deep" } },
	{ key: "social", label: "Social", value: 2800, color: "chart-3", fill: { kind: "gradient", tone: "deep" } },
	{ key: "email", label: "Email", value: 1900, color: "chart-4", fill: { kind: "gradient", tone: "deep" } },
	{ key: "referral", label: "Referral", value: 1400, color: "chart-5", fill: { kind: "gradient", tone: "deep" } },
];

const VISITS_PER_THOUSAND = 1000;
const TOTAL_VISITS = SLICES.reduce((sum, slice): number => sum + slice.value, 0);
const CENTER = <DonutCenter value={`${(TOTAL_VISITS / VISITS_PER_THOUSAND).toFixed(1)}k`} caption="Total Visits" />;

// A donut of gradient slices with the total in its hole.
export function Chart19Example(): React.JSX.Element {
	return (
		<ChartCard title="Traffic Sources" description="Where your visitors come from">
			<PieChart slices={SLICES} accessibilityLabel="Visits by source" center={CENTER} formatValue={formatCount} />
		</ChartCard>
	);
}
