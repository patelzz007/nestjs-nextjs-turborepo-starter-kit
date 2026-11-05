import { Query } from "@nestjs/cqrs";
import type { PaginatedServiceResult, WebhookDeliveryListQuery, WebhookDeliverySummary } from "@workspace/shared";

import type { ActorContext } from "../../../../../../platform/application/actor-context";

/** `GET /tenants/:tenantSlug/webhooks/deliveries`: the delivery log, newest first. */
export class ListWebhookDeliveriesQuery extends Query<PaginatedServiceResult<WebhookDeliverySummary>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly tenantId: string,
		public readonly query: WebhookDeliveryListQuery,
	) {
		super();
	}
}
