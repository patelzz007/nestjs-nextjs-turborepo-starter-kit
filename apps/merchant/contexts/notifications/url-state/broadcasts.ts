// The broadcasts page keeps its page in the URL (ADR 023): `/t/[tenantSlug]/broadcasts?page=2` is shareable and undone by Back.

import { listStateToListQuery, type TableFilterState, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState } from "@workspace/client/lib/url-state/url-state";
import { broadcastListQuery, LIST_DEFAULT_LIMIT } from "@workspace/shared";

/** Broadcasts per page. */
export const BROADCASTS_PAGE_SIZE = LIST_DEFAULT_LIMIT;

/** `?page=&cursor=&sort=` — the list keys of `GET /tenants/:tenantSlug/broadcasts`. */
export const BROADCASTS_URL_STATE = defineUrlState({
	...listUrlParams(broadcastListQuery, { pageSizes: [BROADCASTS_PAGE_SIZE], defaultLimit: BROADCASTS_PAGE_SIZE }),
});

export type BroadcastsUrlState = typeof BROADCASTS_URL_STATE.defaults;

export type BroadcastsQueryInput = Pick<TableListQueryInput<TableFilterState>, "page" | "limit" | "cursor" | "sort">;

/** The `GET /tenants/:tenantSlug/broadcasts` input for a URL state. */
export function toBroadcastsQuery(state: BroadcastsUrlState): BroadcastsQueryInput {
	const { page, limit, cursor, sort } = listStateToListQuery(broadcastListQuery, { pagination: state, sort: state.sort });
	return { page, limit, ...(cursor !== undefined ? { cursor } : {}), ...(sort !== undefined ? { sort } : {}) };
}
