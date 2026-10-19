import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { RoleAssignmentInput } from "../assign-role/assign-role.command";

/** Remove a role from another user. Removing a role is as privileged as granting it. */
export class UnassignRoleCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RoleAssignmentInput,
	) {
		super();
	}
}
