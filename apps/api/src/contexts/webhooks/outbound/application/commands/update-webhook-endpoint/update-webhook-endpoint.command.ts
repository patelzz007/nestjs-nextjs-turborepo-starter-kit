import { Command } from "@nestjs/cqrs";
import type { UpdateWebhookEndpoint, WebhookEndpointIdParams, WebhookEndpointSummary } from "@workspace/shared";

import type { ActorContext } from "../../../../../../platform/application/actor-context";

/** `PATCH …/endpoints/:endpointId`: change its address, description or event types. */
export class UpdateWebhookEndpointCommand extends Command<WebhookEndpointSummary> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: UpdateWebhookEndpoint & WebhookEndpointIdParams & { readonly tenantId: string },
	) {
		super();
	}
}
