import { Query } from "@nestjs/cqrs";
import type { EmailPreview, EmailTemplateKey } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Rendered HTML + text of one template with its sample props (never real user data, never sent). */
export class PreviewEmailTemplateQuery extends Query<EmailPreview> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly templateKey: EmailTemplateKey },
	) {
		super();
	}
}
