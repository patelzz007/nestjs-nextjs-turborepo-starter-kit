import { Command } from "@nestjs/cqrs";
import type { PasskeyRegistrationOptionsResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface StartPasskeyRegistrationInput {
	readonly userId: string;
	readonly password: string;
}

/** Start adding a passkey: re-check the password, then issue the creation options and their single-use challenge (ADR 080). */
export class StartPasskeyRegistrationCommand extends Command<PasskeyRegistrationOptionsResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: StartPasskeyRegistrationInput,
	) {
		super();
	}
}
