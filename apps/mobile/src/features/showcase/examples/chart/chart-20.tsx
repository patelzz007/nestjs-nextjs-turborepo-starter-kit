import { PieChart, type ChartSliceDatum } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { ChartCard, DonutCenter } from "./chart-sample";

const SLICES: readonly ChartSliceDatum[] = [
	{ key: "completed", label: "Completed", value: 186, color: "chart-1" },
	{ key: "inProgress", label: "In Progress", value: 94, color: "chart-2" },
	{ key: "pending", label: "Pending", value: 62, color: "chart-3" },
	{ key: "cancelled", label: "Cancelled", value: 28, color: "chart-5" },
];

const PERCENT = 100;
const TOTAL = SLICES.reduce((sum, slice): number => sum + slice.value, 0);
const COMPLETED = SLICES.find((slice): boolean => slice.key === "completed")?.value ?? 0;
const CENTER = <DonutCenter value={`${String(Math.round((COMPLETED / TOTAL) * PERCENT))}%`} caption="Completed" />;

// A donut whose hole reads the completed share, with a legend below.
export function Chart20Example(): React.JSX.Element {
	return (
		<ChartCard title="Task Status" description="Current sprint task breakdown">
			<PieChart slices={SLICES} accessibilityLabel="Sprint tasks by status" center={CENTER} />
		</ChartCard>
	);
}
