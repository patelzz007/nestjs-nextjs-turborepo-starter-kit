import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface SyncUserRolesInput {
	readonly userId: string;
	readonly roleIds: readonly string[];
}

/** Replace another user's direct roles. */
export class SyncUserRolesCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: SyncUserRolesInput,
	) {
		super();
	}
}
