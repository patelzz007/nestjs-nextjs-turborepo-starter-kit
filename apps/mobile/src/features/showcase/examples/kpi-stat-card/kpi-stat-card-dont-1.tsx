import { KpiStatCard, type KpiChange } from "@workspace/ui-native/components/kpi-stat-card";
import * as React from "react";

// More refunds painted as good news, because the number went up.
const REFUNDS_UP: KpiChange = { status: "change", direction: "up", sentiment: "positive", label: "+8.0%" };

export function KpiStatCardDont1Example(): React.JSX.Element {
	return <KpiStatCard label="Refunds" value="RM 1,940" change={REFUNDS_UP} comparisonLabel="vs last month" />;
}
