// The reward catalog's search, filters and page live in the URL (docs/technical/api/list-queries.md §7,
// ADR 023): a filtered catalog is shareable, survives a reload, and back/forward walks
// through the filters. The grid/list LAYOUT is not URL state — it is a per-device
// preference owned by the `ui-preferences` feature store.

import { eqFilter, listStateToListQuery, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { listFilterKey, listSearchParam, listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState, optionalUrlParam } from "@workspace/client/lib/url-state/url-state";
import { PilotCitySchema, RewardCategorySchema, rewardListQuery, type PilotCity, type RewardCategory } from "@workspace/shared";

/** Offers per catalog page — a 3 × 4 grid. Fixed, so it never appears in the URL. */
export const REWARDS_BROWSE_PAGE_SIZE = 12;

/** The catalog offers one page size; `?limit=` with any other value falls back to it. */
const REWARDS_BROWSE_PAGE_SIZES: readonly number[] = [REWARDS_BROWSE_PAGE_SIZE];

/**
 * Catalog state on `/rewardhub` and the public landing page `/`:
 * `?page=&cursor=&sort=&search=&filter[city]=&filter[category]=` — the same keys
 * `GET /rewards` takes, so a catalog URL maps 1:1 onto the request.
 */
export const REWARDS_BROWSE_URL_STATE = defineUrlState(
	{
		...listUrlParams(rewardListQuery, { pageSizes: REWARDS_BROWSE_PAGE_SIZES, defaultLimit: REWARDS_BROWSE_PAGE_SIZE }),
		search: listSearchParam(),
		city: optionalUrlParam(PilotCitySchema),
		category: optionalUrlParam(RewardCategorySchema),
	},
	{ urlKeys: { city: listFilterKey("city"), category: listFilterKey("category") } },
);

export type RewardsBrowseUrlState = typeof REWARDS_BROWSE_URL_STATE.defaults;

export type RewardsBrowseListFilter = Readonly<{
	city: { eq: PilotCity } | undefined;
	category: { eq: RewardCategory } | undefined;
}>;

/** The `GET /rewards` input for a URL state — built by the server page (prefetch) and the catalog (query) alike. */
export function toRewardsBrowseListQuery(state: RewardsBrowseUrlState): TableListQueryInput<RewardsBrowseListFilter> {
	return listStateToListQuery(rewardListQuery, {
		pagination: state,
		sort: state.sort,
		search: state.search,
		filter: { city: eqFilter(state.city), category: eqFilter(state.category) },
	});
}
