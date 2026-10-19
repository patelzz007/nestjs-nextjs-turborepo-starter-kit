import type { PaginatedServiceResult, RewardClaimListQuery, RewardClaimResponse, RewardNotificationListQuery, RewardNotificationResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/** Claim projections, under the caller's own RLS session (a customer sees only their own claims). */
export interface ClaimReadPort {
	listForUser(actor: ActorContext, userId: string, query: RewardClaimListQuery): Promise<PaginatedServiceResult<RewardClaimResponse>>;

	/** One of the user's own live claims; null otherwise. Never carries the codes. */
	findForUser(actor: ActorContext, userId: string, claimId: string): Promise<RewardClaimResponse | null>;
}

/** The customer's reward inbox. */
export interface RewardNotificationReadPort {
	/** One page of the inbox, newest first; `filter[readAt][isNull]` narrows it to the unread ones (the badge counts `meta.total`). */
	listForUser(actor: ActorContext, userId: string, query: RewardNotificationListQuery): Promise<PaginatedServiceResult<RewardNotificationResponse>>;
}
