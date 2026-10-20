import { Query } from "@nestjs/cqrs";
import type { AdminUserDetail, AdminUserListQuery, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface ListUsersForAdminInput {
	readonly query: AdminUserListQuery;
}

/** SuperAdmin user list (roles and referral facts batched: no N+1). */
export class ListUsersForAdminQuery extends Query<PaginatedServiceResult<AdminUserDetail>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ListUsersForAdminInput,
	) {
		super();
	}
}
