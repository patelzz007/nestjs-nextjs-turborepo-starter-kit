import { ReceivedWebhookDetailPageSkeleton } from "@/components/loading/received-webhook-skeletons";

/**
 * `/webhooks/received/[id]` while the webhook is fetched — mirrors `ReceivedWebhookDetailView`.
 */
export default function ReceivedWebhookDetailLoading(): React.JSX.Element {
	return <ReceivedWebhookDetailPageSkeleton />;
}
