import { StatusIncidentsView } from "@/contexts/operations/components/status-page/status-incidents-view";

export const dynamic = "force-dynamic";

/** `/operations/status` — the incidents on the public status page (enhancement 4.5). */
export default function OperationsStatusPage(): React.JSX.Element {
	return <StatusIncidentsView />;
}
