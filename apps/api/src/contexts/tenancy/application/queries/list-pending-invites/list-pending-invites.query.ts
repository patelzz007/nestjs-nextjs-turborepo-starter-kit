import { Query } from "@nestjs/cqrs";
import type { TenantMemberInviteListQuery, TenantMemberInviteResponse, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One page of the pending team invites (`merchant:manage_team`). */
export class ListPendingInvitesQuery extends Query<PaginatedServiceResult<TenantMemberInviteResponse>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly tenantSlug: string; readonly query: TenantMemberInviteListQuery },
	) {
		super();
	}
}
