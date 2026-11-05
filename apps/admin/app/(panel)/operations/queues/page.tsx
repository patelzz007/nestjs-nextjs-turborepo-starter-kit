import { QueuesView } from "@/contexts/operations/components/queues-view";

export const dynamic = "force-dynamic";

/** `/operations/queues` — every background job queue, its failures, retry and discard (enhancement 4.4). */
export default function OperationsQueuesPage(): React.JSX.Element {
	return <QueuesView />;
}
