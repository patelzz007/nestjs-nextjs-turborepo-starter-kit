import { Query } from "@nestjs/cqrs";
import type { OrganizationRewardMembershipResponse, OwnMembershipListQuery, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One page of the signed-in user's ACTIVE memberships (the merchant app's store switcher and stores page). */
export class ListMyMembershipsQuery extends Query<PaginatedServiceResult<OrganizationRewardMembershipResponse>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly query: OwnMembershipListQuery,
	) {
		super();
	}
}
