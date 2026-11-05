import { Command } from "@nestjs/cqrs";
import type { CreateWebhookEndpoint, WebhookEndpointWithSecret } from "@workspace/shared";

import type { ActorContext } from "../../../../../../platform/application/actor-context";

/** `POST /tenants/:tenantSlug/webhooks/endpoints`: register an endpoint; its signing secret is answered once. */
export class CreateWebhookEndpointCommand extends Command<WebhookEndpointWithSecret> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CreateWebhookEndpoint & { readonly tenantId: string },
	) {
		super();
	}
}
