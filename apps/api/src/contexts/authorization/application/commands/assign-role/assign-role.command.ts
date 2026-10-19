import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface RoleAssignmentInput {
	readonly userId: string;
	readonly roleId: string;
}

/** Assign a role to another user. */
export class AssignRoleCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RoleAssignmentInput,
	) {
		super();
	}
}
