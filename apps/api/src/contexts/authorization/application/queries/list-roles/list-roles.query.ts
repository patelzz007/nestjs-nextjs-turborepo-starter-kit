import { Query } from "@nestjs/cqrs";
import type { PaginatedServiceResult, RoleListItem, RoleListQuery } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One page of the live roles (admin list and role pickers). */
export class ListRolesQuery extends Query<PaginatedServiceResult<RoleListItem>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly query: RoleListQuery,
	) {
		super();
	}
}
