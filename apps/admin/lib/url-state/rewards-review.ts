import { listStateToListQuery } from "@workspace/client/lib/api/list-query";
import { listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState } from "@workspace/client/lib/url-state/url-state";
import { adminPendingRewardListQuery, AdminPendingRewardListQuerySchema, REWARD_LIST_DEFAULT_LIMIT, type AdminPendingRewardListQuery } from "@workspace/shared";

/** Page sizes the moderation queue offers (the API's default is one of them). */
export const REWARDS_REVIEW_PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50];

/**
 * `/rewards/review` state: `?page=&limit=&cursor=` — the keys of
 * `GET /admin/rewards/pending` (oldest first). Shared by the server prefetch
 * and the client query, so the prefetched page lands under the client's key.
 */
export const REWARDS_REVIEW_URL_STATE = defineUrlState({
	...listUrlParams(adminPendingRewardListQuery, { pageSizes: REWARDS_REVIEW_PAGE_SIZE_OPTIONS, defaultLimit: REWARD_LIST_DEFAULT_LIMIT }),
});

export type RewardsReviewUrlState = typeof REWARDS_REVIEW_URL_STATE.defaults;

/** The `GET /admin/rewards/pending` input for a URL state (the endpoint takes no filters). */
export function toPendingRewardsListQuery(state: RewardsReviewUrlState): AdminPendingRewardListQuery {
	return AdminPendingRewardListQuerySchema.parse(listStateToListQuery(adminPendingRewardListQuery, { pagination: state, sort: state.sort }));
}
