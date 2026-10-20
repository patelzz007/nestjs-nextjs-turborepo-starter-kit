import { Query } from "@nestjs/cqrs";
import type { TenantRewardMembershipResponse, OwnMembershipListQuery, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One page of the signed-in user's ACTIVE memberships (the merchant app's store switcher and stores page). */
export class ListMyMembershipsQuery extends Query<PaginatedServiceResult<TenantRewardMembershipResponse>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly query: OwnMembershipListQuery,
	) {
		super();
	}
}
