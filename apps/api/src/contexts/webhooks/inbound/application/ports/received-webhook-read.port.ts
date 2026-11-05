import type { PaginatedServiceResult, ReceivedWebhookDetail, ReceivedWebhookListQuery, ReceivedWebhookSummary } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** The admin viewer's read side of the received-webhook log (operation `webhooks.inbound.read`, after the AUDIT_LOG check). */
export interface ReceivedWebhookReadPort {
	list(actor: ActorContext, query: ReceivedWebhookListQuery): Promise<PaginatedServiceResult<ReceivedWebhookSummary>>;
	findById(actor: ActorContext, id: string): Promise<ReceivedWebhookDetail | null>;
}
