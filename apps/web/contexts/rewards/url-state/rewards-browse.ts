// The reward catalog's search, filters and page live in the URL (docs/technical/api/list-queries.md §7,
// ADR 023): a filtered catalog is shareable, survives a reload, and back/forward walks
// through the filters. The grid/list LAYOUT is not URL state — it is a per-device
// preference owned by the `ui-preferences` feature store.

import { eqFilter, listStateToListQuery, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { listFilterKey, listSearchParam, listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState, optionalBooleanUrlParam, optionalUrlParam } from "@workspace/client/lib/url-state/url-state";
import { PilotCitySchema, RewardCategorySchema, rewardListQuery, type PilotCity, type RewardCategory } from "@workspace/shared";

/** Offers per catalog page — a 3 × 4 grid. Fixed, so it never appears in the URL. */
export const REWARDS_BROWSE_PAGE_SIZE = 12;

/** The catalog offers one page size; `?limit=` with any other value falls back to it. */
const REWARDS_BROWSE_PAGE_SIZES: readonly number[] = [REWARDS_BROWSE_PAGE_SIZE];

/**
 * Catalog state on `/dashboard` and the public landing page `/`:
 * `?page=&cursor=&sort=&search=&filter[city]=&filter[category]=` — the same keys
 * `GET /rewards` takes, so a catalog URL maps 1:1 onto the request — plus `hideLocked`,
 * which becomes the absence of `includeLocked` (see {@link toRewardsBrowseListQuery}).
 */
export const REWARDS_BROWSE_URL_STATE = defineUrlState(
	{
		...listUrlParams(rewardListQuery, { pageSizes: REWARDS_BROWSE_PAGE_SIZES, defaultLimit: REWARDS_BROWSE_PAGE_SIZE }),
		search: listSearchParam(),
		city: optionalUrlParam(PilotCitySchema),
		category: optionalUrlParam(RewardCategorySchema),
		/** `?hideLocked=true`: leave out the rewards the viewer's tier does not reach (ADR 085). */
		hideLocked: optionalBooleanUrlParam(),
	},
	{ urlKeys: { city: listFilterKey("city"), category: listFilterKey("category") } },
);

export type RewardsBrowseUrlState = typeof REWARDS_BROWSE_URL_STATE.defaults;

export type RewardsBrowseListFilter = Readonly<{
	city: { eq: PilotCity } | undefined;
	category: { eq: RewardCategory } | undefined;
}>;

/** Whether the catalog lists locked rewards: while tiers are on, unless the viewer hid them (ADR 085). */
export function showsLockedRewards(state: RewardsBrowseUrlState, tiersOn: boolean): boolean {
	return tiersOn && state.hideLocked !== true;
}

/**
 * The `GET /rewards` input for a URL state — built by the server page (prefetch) and the catalog (query) alike.
 * With locked rewards listed, the API puts the claimable ones first and pages by `page` alone, so no cursor is sent.
 */
export function toRewardsBrowseListQuery(state: RewardsBrowseUrlState, tiersOn: boolean): TableListQueryInput<RewardsBrowseListFilter> {
	const showsLocked = showsLockedRewards(state, tiersOn);
	const input = listStateToListQuery(rewardListQuery, {
		// The grouped list (claimable first) pages by `page` alone, so its cursor is never sent.
		pagination: showsLocked ? { page: state.page, limit: state.limit } : state,
		sort: state.sort,
		search: state.search,
		filter: { city: eqFilter(state.city), category: eqFilter(state.category) },
	});
	return showsLocked ? { ...input, includeLocked: true } : input;
}
