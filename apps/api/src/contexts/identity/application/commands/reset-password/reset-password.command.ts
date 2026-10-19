import { Command } from "@nestjs/cqrs";
import type { ResetPasswordResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface ResetPasswordInput {
	readonly token: string;
	readonly password: string;
}

/** Reset the password with a link (D12: the token is consumed by compare-and-set on `used_at IS NULL`). */
export class ResetPasswordCommand extends Command<ResetPasswordResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ResetPasswordInput,
	) {
		super();
	}
}
