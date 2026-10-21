import { Command } from "@nestjs/cqrs";
import type { AdminUserBanResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface BanUserInput {
	readonly userId: string;
	/** The platform admin banning the account. */
	readonly adminUserId: string;
	readonly reason: string;
}

/** A platform admin bans an account: deactivated, every session revoked, its tokens dead. */
export class BanUserCommand extends Command<AdminUserBanResult> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: BanUserInput,
	) {
		super();
	}
}
