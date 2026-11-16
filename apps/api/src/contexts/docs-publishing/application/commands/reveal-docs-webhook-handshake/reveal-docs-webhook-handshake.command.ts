import { Command } from "@nestjs/cqrs";
import type { DocsWebhookHandshake } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** An operator asking for the waiting verification token. A command, not a query: reading a secret is audited. */
export class RevealDocsWebhookHandshakeCommand extends Command<DocsWebhookHandshake> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
