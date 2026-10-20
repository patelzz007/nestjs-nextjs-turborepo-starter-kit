import { Command } from "@nestjs/cqrs";
import type { ConsumerWebSignupInput, SignupResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface SignUpInput {
	readonly body: ConsumerWebSignupInput;
	readonly clientType: string | undefined;
}

/** Register a consumer account (D14: account, first referral code, referral and default role in ONE transaction). */
export class SignUpCommand extends Command<SignupResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: SignUpInput,
	) {
		super();
	}
}
