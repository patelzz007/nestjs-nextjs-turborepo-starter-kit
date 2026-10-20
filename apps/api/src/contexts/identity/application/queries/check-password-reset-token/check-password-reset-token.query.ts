import { Query } from "@nestjs/cqrs";
import type { ValidateResetTokenResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface CheckPasswordResetTokenInput {
	readonly token: string;
}

/** Whether a reset token is valid, without consuming it. */
export class CheckPasswordResetTokenQuery extends Query<ValidateResetTokenResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CheckPasswordResetTokenInput,
	) {
		super();
	}
}
