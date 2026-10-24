import { Command } from "@nestjs/cqrs";
import type { SetUserPreferenceInput, UserPreference } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `PUT /auth/preferences/:key` — remember one of the signed-in user's choices. */
export class SetOwnPreferenceCommand extends Command<UserPreference> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly userId: string,
		public readonly input: SetUserPreferenceInput,
	) {
		super();
	}
}
