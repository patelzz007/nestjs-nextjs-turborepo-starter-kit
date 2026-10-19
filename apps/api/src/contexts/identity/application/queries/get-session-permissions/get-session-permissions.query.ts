import { Query } from "@nestjs/cqrs";
import type { AccessTokenPayload, SessionPermissionsResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface GetSessionPermissionsInput {
	readonly userId: string;
	readonly accessPayload: AccessTokenPayload | undefined;
}

/** The current session's roles, permissions and scope (cached base). */
export class GetSessionPermissionsQuery extends Query<SessionPermissionsResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GetSessionPermissionsInput,
	) {
		super();
	}
}
