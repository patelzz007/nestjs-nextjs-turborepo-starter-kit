import { Command } from "@nestjs/cqrs";
import type { PasskeyAuthenticationOptionsResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface StartPasskeySecondFactorInput {
	readonly tempToken: string;
}

/** The options of a passkey second factor for an open password sign-in (ADR 080). */
export class StartPasskeySecondFactorCommand extends Command<PasskeyAuthenticationOptionsResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: StartPasskeySecondFactorInput,
	) {
		super();
	}
}
