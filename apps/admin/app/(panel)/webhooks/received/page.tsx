import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, resolvePrefetchedQuery } from "@/lib/server/prefetch";
import { RECEIVED_WEBHOOKS_URL_STATE, toReceivedWebhookListQuery } from "@/contexts/webhooks/url-state/received-webhooks";

import ReceivedWebhooksView from "../../../../contexts/webhooks/components/received-webhooks-table";

export const dynamic = "force-dynamic";

/**
 * `/webhooks/received` — parses the table's URL state and fetches that page of
 * the received-webhook log (LIST AUDIT_LOG) server-side.
 */
export default async function ReceivedWebhooksPage({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	const urlState = RECEIVED_WEBHOOKS_URL_STATE.parse(await searchParams);
	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/webhooks/received", resource: "received webhooks" }, () => server.receivedWebhooks.list.query(toReceivedWebhookListQuery(urlState)));

	return <ReceivedWebhooksView initialPage={resolvePrefetchedQuery(RECEIVED_WEBHOOKS_URL_STATE.serialize(urlState), result)} />;
}
