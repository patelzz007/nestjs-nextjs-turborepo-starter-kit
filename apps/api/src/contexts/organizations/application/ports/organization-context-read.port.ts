import type { OrganizationContextResponse, OrganizationRewardMembershipResponse, OwnMembershipListQuery, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/** Reads behind the merchant app's organization switcher and dashboard shell. */
export interface OrganizationContextReadPort {
	/** Uniform 404 for a missing organization and a non-member. */
	getContext(actor: ActorContext, routeKey: string): Promise<OrganizationContextResponse>;
	/** One page of the caller's own active memberships. */
	listMembershipsForUser(actor: ActorContext, query: OwnMembershipListQuery): Promise<PaginatedServiceResult<OrganizationRewardMembershipResponse>>;
}
