import { Command } from "@nestjs/cqrs";
import type { UserPreferenceKey, UserPreferences } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `DELETE /auth/preferences/:key` — "Reset to default". */
export class ResetOwnPreferenceCommand extends Command<UserPreferences> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly userId: string,
		public readonly key: UserPreferenceKey,
	) {
		super();
	}
}
