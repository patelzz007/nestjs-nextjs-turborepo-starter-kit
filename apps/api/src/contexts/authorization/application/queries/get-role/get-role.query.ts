import { Query } from "@nestjs/cqrs";
import type { RoleResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One live role (404 when no live role has that id). */
export class GetRoleQuery extends Query<RoleResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly roleId: string,
	) {
		super();
	}
}
