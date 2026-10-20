import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface SyncUserPermissionsInput {
	readonly userId: string;
	readonly permissionIds: readonly string[];
}

/** Replace another user's direct ALLOW grants. DENY overrides are left untouched. */
export class SyncUserPermissionsCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: SyncUserPermissionsInput,
	) {
		super();
	}
}
