import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface RevokeInviteInput {
	readonly tenantSlug: string;
	readonly inviteId: string;
}

/** A team manager withdraws a pending team invite. */
export class RevokeInviteCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RevokeInviteInput,
	) {
		super();
	}
}
