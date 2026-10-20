import { Query } from "@nestjs/cqrs";
import type { TenantMemberListQuery, TenantMemberRosterResponse, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One page of the live members with their names and emails (`merchant:manage_team`). */
export class ListMembersQuery extends Query<PaginatedServiceResult<TenantMemberRosterResponse>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly tenantSlug: string; readonly query: TenantMemberListQuery },
	) {
		super();
	}
}
