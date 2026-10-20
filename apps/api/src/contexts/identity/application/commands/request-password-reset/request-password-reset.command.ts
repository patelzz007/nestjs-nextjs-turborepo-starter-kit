import { Command } from "@nestjs/cqrs";
import type { ForgotPasswordResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface RequestPasswordResetInput {
	readonly email: string;
	readonly clientType: string | undefined;
}

/** Email a password reset link: older open links expire and the new one is stored in one transaction. */
export class RequestPasswordResetCommand extends Command<ForgotPasswordResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RequestPasswordResetInput,
	) {
		super();
	}
}
