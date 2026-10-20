import { Query } from "@nestjs/cqrs";
import type { OwnProfile } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface GetOwnProfileInput {
	readonly userId: string;
}

/** The signed-in user's own profile. */
export class GetOwnProfileQuery extends Query<OwnProfile> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GetOwnProfileInput,
	) {
		super();
	}
}
