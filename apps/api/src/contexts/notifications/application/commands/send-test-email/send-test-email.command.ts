import { Command } from "@nestjs/cqrs";
import type { EmailSendResult, EmailTemplateKey } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Request ONE template with its sample props (never real user data), audited on the log row. */
export class SendTestEmailCommand extends Command<EmailSendResult> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly templateKey: EmailTemplateKey },
	) {
		super();
	}
}
