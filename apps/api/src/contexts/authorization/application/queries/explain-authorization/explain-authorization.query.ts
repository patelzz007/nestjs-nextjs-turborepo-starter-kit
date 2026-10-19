import { Query } from "@nestjs/cqrs";
import type { AuthorizationExplainQuery, AuthorizationResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Admin: step-by-step explanation of one decision, for the caller or another user. */
export class ExplainAuthorizationQuery extends Query<AuthorizationResult> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly explain: AuthorizationExplainQuery,
	) {
		super();
	}
}
