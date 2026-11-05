import { Command } from "@nestjs/cqrs";
import type { DeleteSuccessData, WebhookEndpointIdParams } from "@workspace/shared";

import type { ActorContext } from "../../../../../../platform/application/actor-context";

/** `DELETE …/endpoints/:endpointId`: remove it (soft delete); its deliveries stay in the log. */
export class DeleteWebhookEndpointCommand extends Command<DeleteSuccessData> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: WebhookEndpointIdParams & { readonly tenantId: string },
	) {
		super();
	}
}
