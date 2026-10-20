// The rewards catalog's view lives in the URL (ADR 023, docs/technical/api/list-queries.md §7): the status
// tab and the page within it — shareable, refresh-safe and undone by Back. The tab is a server filter: the
// catalog asks `GET /orgs/:orgSlug/rewards` for that tab's statuses, one page at a time. The STORE is not URL
// state — it is the member's choice, owned by the tenant-context feature store, and joins the request as the
// `locationId` scope.

import { listStateToListQuery, type TableFilterState, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { LIST_FIRST_PAGE, listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState, optionalUrlParam } from "@workspace/client/lib/url-state/url-state";
import { merchantRewardListQuery, type RewardStatus } from "@workspace/shared";

import { RewardStatusGroupIdSchema, statusesOfGroup, type RewardStatusGroupId } from "@/contexts/rewards/lib/presentation";

/** Rewards per page: four rows of the widest grid (three columns), six of the narrower one. */
export const REWARD_CATALOG_PAGE_SIZE = 12;

/**
 * `/orgs/[orgSlug]/rewards?status=live|review|drafts|ended&page=&cursor=&sort=`. An absent (or unknown)
 * `status` means "the first tab with rewards" — that depends on the catalog's figures, so it is resolved by
 * `defaultRewardStatusGroupId`, not here.
 */
export const REWARDS_URL_STATE = defineUrlState({
	status: optionalUrlParam(RewardStatusGroupIdSchema),
	...listUrlParams(merchantRewardListQuery, { pageSizes: [REWARD_CATALOG_PAGE_SIZE], defaultLimit: REWARD_CATALOG_PAGE_SIZE }),
});

export type RewardsUrlState = typeof REWARDS_URL_STATE.defaults;

/** The rewards request of one tab: the URL's list keys, the tab's statuses, the organization and the store scope. */
export type RewardsQueryInput = Pick<TableListQueryInput<TableFilterState>, "page" | "limit" | "cursor" | "sort"> & {
	readonly orgSlug: string;
	/** The tenant-context store filter (`undefined` = every store the member may see). */
	readonly locationId: string | undefined;
	readonly filter: { readonly status: { readonly in: RewardStatus[] } };
};

/** The `GET /orgs/:orgSlug/rewards` input for the open tab (`groupId`, already resolved) and the URL's page. */
export function toRewardsQuery(orgSlug: string, locationId: string | undefined, state: RewardsUrlState, groupId: RewardStatusGroupId): RewardsQueryInput {
	const { page, limit, cursor, sort } = listStateToListQuery(merchantRewardListQuery, { pagination: state, sort: state.sort });
	return {
		orgSlug,
		page,
		limit,
		...(cursor !== undefined ? { cursor } : {}),
		...(sort !== undefined ? { sort } : {}),
		locationId,
		filter: { status: { in: [...statusesOfGroup(groupId)] } },
	};
}

/** The patch that opens another tab: its first page (a page number belongs to one tab's list). */
export function rewardsTabPatch(groupId: RewardStatusGroupId): Pick<RewardsUrlState, "status" | "page" | "cursor"> {
	return { status: groupId, page: LIST_FIRST_PAGE, cursor: undefined };
}
