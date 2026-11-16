import * as React from "react";
import { KpiStatCard, type KpiChange } from "@workspace/ui/components/kpi-stat-card";
import { ReceiptIcon } from "lucide-react";

const NEW_METRIC: KpiChange = { status: "noPrevious", label: "New this period" };

export function KpiStatCardDo2Example(): React.JSX.Element {
	return <KpiStatCard label="Referrals" value="214" change={NEW_METRIC} icon={ReceiptIcon} iconTone="violet" />;
}
