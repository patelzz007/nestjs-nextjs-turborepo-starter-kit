import { RECEIVED_WEBHOOKS_LOADING_LABELS } from "@/components/loading/loading-labels";
import { RECEIVED_WEBHOOKS_TABLE_PAGE, TablePageSkeleton } from "@/components/loading/table-page-skeleton";

/**
 * `/webhooks/received` while the page of deliveries is fetched — mirrors `ReceivedWebhooksView`.
 */
export default function ReceivedWebhooksLoading(): React.JSX.Element {
	return <TablePageSkeleton labels={RECEIVED_WEBHOOKS_LOADING_LABELS} shape={RECEIVED_WEBHOOKS_TABLE_PAGE} />;
}
