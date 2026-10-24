import { Query } from "@nestjs/cqrs";
import type { UserPreferences } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /auth/preferences`. */
export class ListOwnPreferencesQuery extends Query<UserPreferences> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly userId: string,
	) {
		super();
	}
}
