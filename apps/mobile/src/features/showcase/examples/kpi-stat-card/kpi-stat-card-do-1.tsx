import { KpiStatCard, type KpiChange } from "@workspace/ui-native/components/kpi-stat-card";
import * as React from "react";

const REFUNDS_UP: KpiChange = { status: "change", direction: "up", sentiment: "negative", label: "+8.0%" };

export function KpiStatCardDo1Example(): React.JSX.Element {
	return <KpiStatCard label="Refunds" value="RM 1,940" change={REFUNDS_UP} comparisonLabel="vs last month" />;
}
