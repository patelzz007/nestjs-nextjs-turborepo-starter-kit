import { Command } from "@nestjs/cqrs";
import type { RoleResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Set (or clear, with `null`) the parent of a non-system role. */
export class ReparentRoleCommand extends Command<RoleResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly roleId: string,
		public readonly parentId: string | null,
	) {
		super();
	}
}
