import { Command } from "@nestjs/cqrs";
import type { ChangePasswordResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface ChangePasswordInput {
	readonly userId: string;
	readonly currentPassword: string;
	readonly newPassword: string;
}

/** The signed-in user changes their password (D35: compare-and-set on the loaded `tokenVersion`). */
export class ChangePasswordCommand extends Command<ChangePasswordResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ChangePasswordInput,
	) {
		super();
	}
}
