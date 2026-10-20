import type { TenantContextResponse, TenantRewardMembershipResponse, OwnMembershipListQuery, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/** Reads behind the merchant app's tenant switcher and dashboard shell. */
export interface TenantContextReadPort {
	/** Uniform 404 for a missing tenant and a non-member. */
	getContext(actor: ActorContext, routeKey: string): Promise<TenantContextResponse>;
	/** One page of the caller's own active memberships. */
	listMembershipsForUser(actor: ActorContext, query: OwnMembershipListQuery): Promise<PaginatedServiceResult<TenantRewardMembershipResponse>>;
}
