import { Command } from "@nestjs/cqrs";
import type { AdminUserBanResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface UnbanUserInput {
	readonly userId: string;
}

/** A platform admin lifts an account's ban: it may sign in again (its revoked sessions stay revoked). */
export class UnbanUserCommand extends Command<AdminUserBanResult> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: UnbanUserInput,
	) {
		super();
	}
}
