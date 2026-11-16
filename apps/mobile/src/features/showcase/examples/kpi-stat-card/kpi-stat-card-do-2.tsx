import { KpiStatCard, type KpiChange } from "@workspace/ui-native/components/kpi-stat-card";
import * as React from "react";

const NEW_METRIC: KpiChange = { status: "noPrevious", label: "New this period" };

export function KpiStatCardDo2Example(): React.JSX.Element {
	return <KpiStatCard label="Referrals" value="214" change={NEW_METRIC} />;
}
