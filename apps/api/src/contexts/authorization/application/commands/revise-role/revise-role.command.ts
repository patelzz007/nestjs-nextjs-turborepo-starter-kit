import { Command } from "@nestjs/cqrs";
import type { RoleResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { RoleRevision } from "../../../domain/aggregates/role.aggregate";

/** Update a non-system role's metadata (name, description, active flag). */
export class ReviseRoleCommand extends Command<RoleResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly roleId: string,
		public readonly revision: RoleRevision,
	) {
		super();
	}
}
