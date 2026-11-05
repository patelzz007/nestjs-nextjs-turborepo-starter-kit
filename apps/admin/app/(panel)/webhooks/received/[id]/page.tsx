import { ReceivedWebhookIdParamSchema } from "@workspace/shared";
import { notFound } from "next/navigation";

import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, resolvePrefetchedData } from "@/lib/server/prefetch";

import ReceivedWebhookDetailView from "../../../../../contexts/webhooks/components/received-webhook-detail";

export const dynamic = "force-dynamic";

/**
 * `/webhooks/received/[id]` — one received webhook (READ AUDIT_LOG), read-only.
 * The id is validated with the API's own param schema: a malformed id is a 404,
 * never an API call.
 */
export default async function ReceivedWebhookDetailPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
	const parsed = ReceivedWebhookIdParamSchema.safeParse(await params);
	if (!parsed.success) {
		notFound();
	}
	const id: string = parsed.data.id;
	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/webhooks/received/[id]", resource: "received webhook" }, () => server.receivedWebhooks.detail.query({ id }));

	return <ReceivedWebhookDetailView id={id} initialRecord={resolvePrefetchedData(result)} />;
}
