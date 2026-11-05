import type { PaginatedServiceResult, WebhookDeliveryListQuery, WebhookDeliverySummary, WebhookEndpointListQuery, WebhookEndpointSummary } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** The merchant console's reads of a tenant's endpoints and delivery log, under the member's own RLS session. */
export interface WebhooksReadPort {
	listEndpoints(actor: ActorContext, tenantId: string, query: WebhookEndpointListQuery): Promise<PaginatedServiceResult<WebhookEndpointSummary>>;
	findEndpoint(actor: ActorContext, tenantId: string, endpointId: string): Promise<WebhookEndpointSummary | null>;
	listDeliveries(actor: ActorContext, tenantId: string, query: WebhookDeliveryListQuery): Promise<PaginatedServiceResult<WebhookDeliverySummary>>;
	findDelivery(actor: ActorContext, tenantId: string, deliveryId: string): Promise<WebhookDeliverySummary | null>;
}
