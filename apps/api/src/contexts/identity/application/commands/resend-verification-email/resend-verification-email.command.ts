import { Command } from "@nestjs/cqrs";
import type { ResendVerificationResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface ResendVerificationEmailInput {
	readonly email: string;
	readonly clientType: string | undefined;
}

/** Resend the email-verification link (same answer whether or not the account exists). */
export class ResendVerificationEmailCommand extends Command<ResendVerificationResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ResendVerificationEmailInput,
	) {
		super();
	}
}
