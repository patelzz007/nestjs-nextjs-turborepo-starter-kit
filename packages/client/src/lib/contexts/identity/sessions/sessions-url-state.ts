// The "Signed-in devices" list keeps its page in the URL (docs/technical/api/list-queries.md §7), under
// `devices*` keys: it is one section of a settings page, so the generic `page` key stays free for the page.

import { SESSION_LIST_PAGE_SIZE, sessionListQuery } from "@workspace/shared";

import { listStateToListQuery, type TableFilterState, type TableListQueryInput } from "../../../api/list-query";
import { listUrlParams } from "../../../url-state/list-url-state";
import { defineUrlState } from "../../../url-state/url-state";

/** `?devicesPage=&devicesCursor=&devicesSort=` — the list keys of `GET /auth/sessions`. */
export const SESSIONS_URL_STATE = defineUrlState(
	{ ...listUrlParams(sessionListQuery, { pageSizes: [SESSION_LIST_PAGE_SIZE], defaultLimit: SESSION_LIST_PAGE_SIZE }) },
	{ urlKeys: { page: "devicesPage", limit: "devicesLimit", cursor: "devicesCursor", sort: "devicesSort" } },
);

export type SessionsUrlState = typeof SESSIONS_URL_STATE.defaults;

export type SessionsQueryInput = Pick<TableListQueryInput<TableFilterState>, "page" | "limit" | "cursor" | "sort">;

/** The `GET /auth/sessions` input for a URL state. */
export function toSessionsQuery(state: SessionsUrlState): SessionsQueryInput {
	const { page, limit, cursor, sort } = listStateToListQuery(sessionListQuery, { pagination: state, sort: state.sort });
	return { page, limit, ...(cursor !== undefined ? { cursor } : {}), ...(sort !== undefined ? { sort } : {}) };
}
