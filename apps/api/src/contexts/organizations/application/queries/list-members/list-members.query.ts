import { Query } from "@nestjs/cqrs";
import type { OrganizationMemberListQuery, OrganizationMemberRosterResponse, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One page of the live members with their names and emails (`merchant:manage_team`). */
export class ListMembersQuery extends Query<PaginatedServiceResult<OrganizationMemberRosterResponse>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly orgSlug: string; readonly query: OrganizationMemberListQuery },
	) {
		super();
	}
}
