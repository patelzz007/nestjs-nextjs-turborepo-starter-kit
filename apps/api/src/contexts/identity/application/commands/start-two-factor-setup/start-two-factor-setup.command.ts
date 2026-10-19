import { Command } from "@nestjs/cqrs";
import type { TwoFactorSetupResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface StartTwoFactorSetupInput {
	readonly userId: string;
}

/** Start (or restart) 2FA enrollment. */
export class StartTwoFactorSetupCommand extends Command<TwoFactorSetupResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: StartTwoFactorSetupInput,
	) {
		super();
	}
}
