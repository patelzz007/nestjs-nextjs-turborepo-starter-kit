import { Query } from "@nestjs/cqrs";
import type { WebhookEndpointSummary } from "@workspace/shared";

import type { ActorContext } from "../../../../../../platform/application/actor-context";

/** `GET …/webhooks/endpoints/:endpointId`: one endpoint. */
export class GetWebhookEndpointQuery extends Query<WebhookEndpointSummary> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly tenantId: string,
		public readonly endpointId: string,
	) {
		super();
	}
}
