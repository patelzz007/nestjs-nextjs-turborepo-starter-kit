import { Command } from "@nestjs/cqrs";
import type { WebhookDeliverySummary, WebhookEndpointIdParams } from "@workspace/shared";

import type { ActorContext } from "../../../../../../platform/application/actor-context";

/** `POST …/endpoints/:endpointId/test`: send it a `webhook.test` event now. */
export class SendWebhookTestCommand extends Command<WebhookDeliverySummary> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: WebhookEndpointIdParams & { readonly tenantId: string },
	) {
		super();
	}
}
