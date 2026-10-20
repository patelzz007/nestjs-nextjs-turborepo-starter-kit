import { Query } from "@nestjs/cqrs";
import type { UserResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface GetMeInput {
	readonly userId: string;
}

/** The signed-in user's `/auth/me` payload (cached). */
export class GetMeQuery extends Query<UserResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GetMeInput,
	) {
		super();
	}
}
