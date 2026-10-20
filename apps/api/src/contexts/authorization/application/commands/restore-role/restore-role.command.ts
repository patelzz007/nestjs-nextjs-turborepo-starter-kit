import { Command } from "@nestjs/cqrs";
import type { RoleResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Restore a soft-deleted role (live and active again). */
export class RestoreRoleCommand extends Command<RoleResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly roleId: string,
	) {
		super();
	}
}
