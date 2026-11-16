import * as React from "react";
import { KpiStatCard, type KpiChange } from "@workspace/ui/components/kpi-stat-card";
import { ReceiptIcon } from "lucide-react";

const AGAINST_NOTHING: KpiChange = { status: "change", direction: "up", sentiment: "positive", label: "+∞%" };

export function KpiStatCardDont2Example(): React.JSX.Element {
	return <KpiStatCard label="Referrals" value="214" change={AGAINST_NOTHING} comparisonLabel="vs last month" icon={ReceiptIcon} iconTone="violet" />;
}
