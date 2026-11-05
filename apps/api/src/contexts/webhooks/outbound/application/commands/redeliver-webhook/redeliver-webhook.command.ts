import { Command } from "@nestjs/cqrs";
import type { WebhookDeliveryIdParams, WebhookDeliverySummary } from "@workspace/shared";

import type { ActorContext } from "../../../../../../platform/application/actor-context";

/** `POST …/deliveries/:deliveryId/redeliver`: send a settled delivery again, from attempt one. */
export class RedeliverWebhookCommand extends Command<WebhookDeliverySummary> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: WebhookDeliveryIdParams & { readonly tenantId: string },
	) {
		super();
	}
}
