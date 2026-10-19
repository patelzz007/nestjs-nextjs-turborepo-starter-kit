import { Query } from "@nestjs/cqrs";
import type { AuthorizationDecisionsRequest, AuthorizationDecisionsResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** UI capability hints for the caller (the API re-authorizes every operation). */
export class DecideAuthorizationQuery extends Query<AuthorizationDecisionsResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly checks: AuthorizationDecisionsRequest["checks"],
	) {
		super();
	}
}
