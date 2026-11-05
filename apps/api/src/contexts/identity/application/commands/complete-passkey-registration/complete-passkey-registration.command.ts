import { Command } from "@nestjs/cqrs";
import type { Passkey, PasskeyRegistrationResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface CompletePasskeyRegistrationInput {
	readonly userId: string;
	readonly challengeId: string;
	readonly name: string;
	readonly response: PasskeyRegistrationResponse;
}

/** Finish adding a passkey with the browser's registration response (ADR 080). */
export class CompletePasskeyRegistrationCommand extends Command<Passkey> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CompletePasskeyRegistrationInput,
	) {
		super();
	}
}
