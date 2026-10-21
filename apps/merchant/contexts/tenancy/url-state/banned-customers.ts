// The banned-customers list's page lives in the URL (ADR 023): `?page=2` is shareable,
// survives a reload, and Back returns to the previous page.

import { listStateToListQuery, type TableFilterState, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState } from "@workspace/client/lib/url-state/url-state";
import { TENANT_CUSTOMER_BAN_LIST_DEFAULT_LIMIT, tenantCustomerBanListQuery } from "@workspace/shared";

/** The list offers one page size; `?limit=` with any other value falls back to it. */
const BANNED_CUSTOMERS_PAGE_SIZES: readonly number[] = [TENANT_CUSTOMER_BAN_LIST_DEFAULT_LIMIT];

/** `/t/[tenantSlug]/settings/banned-customers?page=&cursor=&sort=` — the list keys of `GET /tenants/:tenantSlug/customer-bans`. */
export const BANNED_CUSTOMERS_URL_STATE = defineUrlState({
	...listUrlParams(tenantCustomerBanListQuery, { pageSizes: BANNED_CUSTOMERS_PAGE_SIZES, defaultLimit: TENANT_CUSTOMER_BAN_LIST_DEFAULT_LIMIT }),
});

export type BannedCustomersUrlState = typeof BANNED_CUSTOMERS_URL_STATE.defaults;

/** The customer-bans request: the URL's list keys and the tenant. */
export type BannedCustomersQueryInput = Pick<TableListQueryInput<TableFilterState>, "page" | "limit" | "cursor" | "sort"> & { readonly tenantSlug: string };

export function toBannedCustomersQuery(tenantSlug: string, state: BannedCustomersUrlState): BannedCustomersQueryInput {
	const { page, limit, cursor, sort } = listStateToListQuery(tenantCustomerBanListQuery, { pagination: state, sort: state.sort });
	return { tenantSlug, page, limit, ...(cursor !== undefined ? { cursor } : {}), ...(sort !== undefined ? { sort } : {}) };
}
