import { KpiStatCard, type KpiChange } from "@workspace/ui-native/components/kpi-stat-card";
import * as React from "react";

// A change against nothing: "+∞%" says nothing a reader can use.
const AGAINST_NOTHING: KpiChange = { status: "change", direction: "up", sentiment: "positive", label: "+∞%" };

export function KpiStatCardDont2Example(): React.JSX.Element {
	return <KpiStatCard label="Referrals" value="214" change={AGAINST_NOTHING} />;
}
