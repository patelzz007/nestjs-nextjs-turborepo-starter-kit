import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface RevokeUserPermissionInput {
	readonly userId: string;
	readonly permissionId: string;
}

/** Remove a direct grant or DENY override from another user. */
export class RevokeUserPermissionCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RevokeUserPermissionInput,
	) {
		super();
	}
}
