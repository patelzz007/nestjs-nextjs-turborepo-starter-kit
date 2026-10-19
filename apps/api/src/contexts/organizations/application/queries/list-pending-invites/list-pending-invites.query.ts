import { Query } from "@nestjs/cqrs";
import type { OrganizationMemberInviteListQuery, OrganizationMemberInviteResponse, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One page of the pending team invites (`merchant:manage_team`). */
export class ListPendingInvitesQuery extends Query<PaginatedServiceResult<OrganizationMemberInviteResponse>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly orgSlug: string; readonly query: OrganizationMemberInviteListQuery },
	) {
		super();
	}
}
