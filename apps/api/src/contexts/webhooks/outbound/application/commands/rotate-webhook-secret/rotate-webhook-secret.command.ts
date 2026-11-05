import { Command } from "@nestjs/cqrs";
import type { RotateWebhookSecret, WebhookEndpointIdParams, WebhookEndpointWithSecret } from "@workspace/shared";

import type { ActorContext } from "../../../../../../platform/application/actor-context";

/** `POST …/endpoints/:endpointId/rotate-secret`: a new secret (answered once); the previous one keeps signing for the grace asked for. */
export class RotateWebhookSecretCommand extends Command<WebhookEndpointWithSecret> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RotateWebhookSecret & WebhookEndpointIdParams & { readonly tenantId: string },
	) {
		super();
	}
}
