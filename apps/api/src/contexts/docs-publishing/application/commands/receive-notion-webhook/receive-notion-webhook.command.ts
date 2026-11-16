import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { InboundWebhookRequest } from "../../../../webhooks/inbound/public-api";

/** `handshake` (the token was kept for an operator), `dispatched` (a sync started), `duplicate` or `ignored`. */
export type NotionWebhookOutcome = "handshake" | "dispatched" | "duplicate" | "ignored";

/** One request to the Notion webhook address. */
export class ReceiveNotionWebhookCommand extends Command<NotionWebhookOutcome> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly request: InboundWebhookRequest,
	) {
		super();
	}
}
