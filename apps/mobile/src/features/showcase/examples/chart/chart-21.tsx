import { PieChart, type ChartSliceDatum } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { ChartCard } from "./chart-sample";

const SLICES: readonly ChartSliceDatum[] = [
	{ key: "critical", label: "Critical", value: 14, color: "destructive", fill: { kind: "stripes" } },
	{ key: "high", label: "High", value: 28, color: "chart-4" },
	{ key: "medium", label: "Medium", value: 42, color: "chart-3", fill: { kind: "dots" } },
	{ key: "low", label: "Low", value: 36, color: "chart-5" },
];

// A pie with a striped critical slice in the destructive colour and a dotted medium one beside two solid ones.
export function Chart21Example(): React.JSX.Element {
	return (
		<ChartCard title="Bug Priority" description="Open issues by severity level">
			<PieChart slices={SLICES} accessibilityLabel="Open bugs by priority" hole="sm" />
		</ChartCard>
	);
}
