// The stores page keeps its search and page in the URL (ADR 023, docs/technical/api/list-queries.md §7):
// `/orgs/[orgSlug]/stores?search=bean&page=2` is shareable and undone by Back.

import { listStateToListQuery, type TableFilterState, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { listSearchParam, listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState } from "@workspace/client/lib/url-state/url-state";
import { LIST_DEFAULT_LIMIT, ownMembershipListQuery } from "@workspace/shared";

/** Stores per page. */
export const STORES_PAGE_SIZE = LIST_DEFAULT_LIMIT;

/** `?search=&page=&cursor=&sort=` — the list keys of `GET /orgs/memberships`. */
export const STORES_URL_STATE = defineUrlState({
	...listUrlParams(ownMembershipListQuery, { pageSizes: [STORES_PAGE_SIZE], defaultLimit: STORES_PAGE_SIZE }),
	search: listSearchParam(),
});

export type StoresUrlState = typeof STORES_URL_STATE.defaults;

export type StoresQueryInput = Pick<TableListQueryInput<TableFilterState>, "page" | "limit" | "cursor" | "sort" | "search">;

/** The `GET /orgs/memberships` input for a URL state. */
export function toStoresQuery(state: StoresUrlState): StoresQueryInput {
	const { page, limit, cursor, sort, search } = listStateToListQuery(ownMembershipListQuery, { pagination: state, sort: state.sort, search: state.search });
	return { page, limit, ...(cursor !== undefined ? { cursor } : {}), ...(sort !== undefined ? { sort } : {}), ...(search !== undefined ? { search } : {}) };
}
