import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface PurgeStalePasswordResetTokensInput {
	readonly reason: string;
}

/** Cron: soft-delete used and expired reset tokens past their retention. Returns how many. */
export class PurgeStalePasswordResetTokensCommand extends Command<number> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: PurgeStalePasswordResetTokensInput,
	) {
		super();
	}
}
