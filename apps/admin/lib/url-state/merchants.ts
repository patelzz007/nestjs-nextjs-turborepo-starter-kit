import { eqFilter, listStateToListQuery, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { listFilterKey, listSearchParam, listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState, optionalUrlParam } from "@workspace/client/lib/url-state/url-state";
import { adminMerchantListQuery, KybStatusSchema, MerchantOrgStatusSchema, type KybStatus, type MerchantOrgStatus } from "@workspace/shared";

/** Page sizes the merchant table offers. */
export const MERCHANTS_PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];
/** Default page size — omitted from the URL. */
export const MERCHANTS_DEFAULT_PAGE_SIZE = 20;

/** `/merchants` table state — the keys of `GET /admin/merchants` (`filter[kybStatus]`, `filter[status]`, `search`, paging, sort). */
export const MERCHANTS_TABLE_URL_STATE = defineUrlState(
	{
		...listUrlParams(adminMerchantListQuery, { pageSizes: MERCHANTS_PAGE_SIZE_OPTIONS, defaultLimit: MERCHANTS_DEFAULT_PAGE_SIZE }),
		search: listSearchParam(),
		kybStatus: optionalUrlParam(KybStatusSchema),
		status: optionalUrlParam(MerchantOrgStatusSchema),
	},
	{ urlKeys: { kybStatus: listFilterKey("kybStatus"), status: listFilterKey("status") } },
);

export type MerchantsTableUrlState = typeof MERCHANTS_TABLE_URL_STATE.defaults;

export type MerchantsListFilter = Readonly<{
	kybStatus: { eq: KybStatus } | undefined;
	status: { eq: MerchantOrgStatus } | undefined;
}>;

/** The `GET /admin/merchants` input for a URL state (server prefetch and client query). */
export function toMerchantsListQuery(state: MerchantsTableUrlState): TableListQueryInput<MerchantsListFilter> {
	return listStateToListQuery(adminMerchantListQuery, {
		pagination: state,
		sort: state.sort,
		search: state.search,
		filter: { kybStatus: eqFilter(state.kybStatus), status: eqFilter(state.status) },
	});
}
