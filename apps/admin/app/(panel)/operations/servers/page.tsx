import { OperationsOverview } from "@/contexts/operations/components/operations-overview";

export const dynamic = "force-dynamic";

/** `/operations/servers` — every server, instance and dependency, live, and the open alerts (ADR 068). */
export default function OperationsServersPage(): React.JSX.Element {
	return <OperationsOverview />;
}
