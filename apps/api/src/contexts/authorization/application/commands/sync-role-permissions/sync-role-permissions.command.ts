import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Replace a non-system role's permission set. */
export class SyncRolePermissionsCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly roleId: string,
		public readonly permissionIds: readonly string[],
	) {
		super();
	}
}
