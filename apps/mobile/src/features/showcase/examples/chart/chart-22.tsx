import { PieChart, type ChartSliceDatum } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { ChartCard, DonutCenter, formatCount } from "./chart-sample";

const SLICES: readonly ChartSliceDatum[] = [
	{ key: "free", label: "Free", value: 12800, color: "chart-5" },
	{ key: "starter", label: "Starter", value: 5400, color: "chart-3" },
	{ key: "pro", label: "Pro", value: 3600, color: "chart-2" },
	{ key: "enterprise", label: "Enterprise", value: 1200, color: "chart-1" },
];

const PERCENT = 100;
const TOTAL_USERS = SLICES.reduce((sum, slice): number => sum + slice.value, 0);
const PAID_USERS = TOTAL_USERS - (SLICES.find((slice): boolean => slice.key === "free")?.value ?? 0);
const CONVERSION_RATE = ((PAID_USERS / TOTAL_USERS) * PERCENT).toFixed(1);
const CENTER = <DonutCenter value={formatCount(PAID_USERS)} caption="Paid Users" />;

// Tap a slice or its legend entry and it grows out of the ring.
export function Chart22Example(): React.JSX.Element {
	return (
		<ChartCard title="Conversion Funnel" description={`${CONVERSION_RATE}% of users are on paid plans`}>
			<PieChart slices={SLICES} accessibilityLabel="Users by plan" center={CENTER} formatValue={formatCount} />
		</ChartCard>
	);
}
