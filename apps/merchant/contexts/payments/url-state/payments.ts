// The payments page keeps its page in the URL (ADR 023): `/t/[tenantSlug]/payments?page=2` is shareable and undone by Back.

import { listStateToListQuery, type TableFilterState, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState } from "@workspace/client/lib/url-state/url-state";
import { LIST_DEFAULT_LIMIT, paymentIntentListQuery } from "@workspace/shared";

/** Payments per page. */
export const PAYMENTS_PAGE_SIZE = LIST_DEFAULT_LIMIT;

/** `?page=&cursor=&sort=` — the list keys of `GET /tenants/:tenantSlug/payments`. */
export const PAYMENTS_URL_STATE = defineUrlState({
	...listUrlParams(paymentIntentListQuery, { pageSizes: [PAYMENTS_PAGE_SIZE], defaultLimit: PAYMENTS_PAGE_SIZE }),
});

export type PaymentsUrlState = typeof PAYMENTS_URL_STATE.defaults;

export type PaymentsQueryInput = Pick<TableListQueryInput<TableFilterState>, "page" | "limit" | "cursor" | "sort">;

/** The `GET /tenants/:tenantSlug/payments` input for a URL state. */
export function toPaymentsQuery(state: PaymentsUrlState): PaymentsQueryInput {
	const { page, limit, cursor, sort } = listStateToListQuery(paymentIntentListQuery, { pagination: state, sort: state.sort });
	return { page, limit, ...(cursor !== undefined ? { cursor } : {}), ...(sort !== undefined ? { sort } : {}) };
}
