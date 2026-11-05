import { Command } from "@nestjs/cqrs";
import type { PasskeyAuthenticationOptionsResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface StartPasswordlessPasskeyLoginInput {
	readonly clientType: string | undefined;
}

/** The options of a passwordless sign-in: no account is named, any discoverable passkey of this site may answer (ADR 080). */
export class StartPasswordlessPasskeyLoginCommand extends Command<PasskeyAuthenticationOptionsResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: StartPasswordlessPasskeyLoginInput,
	) {
		super();
	}
}
