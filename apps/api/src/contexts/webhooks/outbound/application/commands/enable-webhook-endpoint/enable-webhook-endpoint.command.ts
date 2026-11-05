import { Command } from "@nestjs/cqrs";
import type { WebhookEndpointIdParams, WebhookEndpointSummary } from "@workspace/shared";

import type { ActorContext } from "../../../../../../platform/application/actor-context";

/** `POST …/endpoints/:endpointId/enable`: switch it on again (past failures are forgotten). */
export class EnableWebhookEndpointCommand extends Command<WebhookEndpointSummary> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: WebhookEndpointIdParams & { readonly tenantId: string },
	) {
		super();
	}
}
