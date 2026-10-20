import { Command } from "@nestjs/cqrs";
import type { OwnProfile, UpdateOwnProfileInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface UpdateOwnProfileCommandInput {
	readonly userId: string;
	readonly isImpersonating: boolean;
	readonly body: UpdateOwnProfileInput;
}

/** Edit the signed-in user's own profile (compare-and-set on `profileVersion`). */
export class UpdateOwnProfileCommand extends Command<OwnProfile> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: UpdateOwnProfileCommandInput,
	) {
		super();
	}
}
