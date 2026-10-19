import { Query } from "@nestjs/cqrs";
import type { EmailPreviewListResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Static metadata of every template (the admin preview index). */
export class ListEmailTemplatesQuery extends Query<EmailPreviewListResponse> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
