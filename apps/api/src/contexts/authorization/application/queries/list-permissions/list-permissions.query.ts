import { Query } from "@nestjs/cqrs";
import type { PaginatedServiceResult, PermissionListItem, PermissionListQuery } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One page of the live permissions (admin catalog and grant tree). */
export class ListPermissionsQuery extends Query<PaginatedServiceResult<PermissionListItem>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly query: PermissionListQuery,
	) {
		super();
	}
}
