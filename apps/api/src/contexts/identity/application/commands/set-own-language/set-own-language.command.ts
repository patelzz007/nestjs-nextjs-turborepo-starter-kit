import { Command } from "@nestjs/cqrs";
import type { AppLanguage, OwnProfile } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface SetOwnLanguageCommandInput {
	readonly userId: string;
	readonly isImpersonating: boolean;
	readonly language: AppLanguage;
}

/** Save the signed-in person's language (enhancement 5.2). */
export class SetOwnLanguageCommand extends Command<OwnProfile> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: SetOwnLanguageCommandInput,
	) {
		super();
	}
}
