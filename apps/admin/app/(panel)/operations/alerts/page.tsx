import { OpsAlertsView } from "@/contexts/operations/components/ops-alerts-view";

export const dynamic = "force-dynamic";

/** `/operations/alerts` — every alert and, for a SuperAdmin, the alert settings (ADR 068). */
export default function OperationsAlertsPage(): React.JSX.Element {
	return <OpsAlertsView />;
}
