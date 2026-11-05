import { Command } from "@nestjs/cqrs";
import type { WebhookEndpointIdParams, WebhookEndpointSummary } from "@workspace/shared";

import type { ActorContext } from "../../../../../../platform/application/actor-context";

/** `POST …/endpoints/:endpointId/disable`: switch it off; nothing is sent to it meanwhile. */
export class DisableWebhookEndpointCommand extends Command<WebhookEndpointSummary> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: WebhookEndpointIdParams & { readonly tenantId: string },
	) {
		super();
	}
}
