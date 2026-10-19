import { Command } from "@nestjs/cqrs";
import type { OkResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /orgs/:orgSlug/api-keys/:keyId/revoke`. */
export class RevokeApiKeyCommand extends Command<OkResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly organizationId: string; readonly keyId: string },
	) {
		super();
	}
}
