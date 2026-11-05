import { Query } from "@nestjs/cqrs";
import type { PaginatedServiceResult, WebhookEndpointListQuery, WebhookEndpointSummary } from "@workspace/shared";

import type { ActorContext } from "../../../../../../platform/application/actor-context";

/** `GET /tenants/:tenantSlug/webhooks/endpoints`: the tenant's endpoints (at most ten, one page). */
export class ListWebhookEndpointsQuery extends Query<PaginatedServiceResult<WebhookEndpointSummary>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly tenantId: string,
		public readonly query: WebhookEndpointListQuery,
	) {
		super();
	}
}
