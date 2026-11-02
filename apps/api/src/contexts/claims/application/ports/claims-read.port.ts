import type { PaginatedServiceResult, RewardClaimListQuery, RewardClaimResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/** Claim projections, under the caller's own RLS session (a customer sees only their own claims). */
export interface ClaimReadPort {
	listForUser(actor: ActorContext, userId: string, query: RewardClaimListQuery): Promise<PaginatedServiceResult<RewardClaimResponse>>;

	/** One of the user's own live claims; null otherwise. Never carries the codes. */
	findForUser(actor: ActorContext, userId: string, claimId: string): Promise<RewardClaimResponse | null>;
}
