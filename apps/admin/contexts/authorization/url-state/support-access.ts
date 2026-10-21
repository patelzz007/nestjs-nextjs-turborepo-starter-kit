import { eqFilter, listStateToListQuery, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { listFilterKey, listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState, optionalUrlParam } from "@workspace/client/lib/url-state/url-state";
import { supportAccessGrantListQuery, SupportAccessGrantStatusSchema, type SupportAccessGrantStatus } from "@workspace/shared";

/** Page sizes the grant list offers. */
export const SUPPORT_ACCESS_PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50];
/** Default page size — omitted from the URL. */
export const SUPPORT_ACCESS_DEFAULT_PAGE_SIZE = 20;

/** `/users/support-access` state: the list keys of `GET /support-access` plus `filter[status]`. */
export const SUPPORT_ACCESS_URL_STATE = defineUrlState(
	{
		...listUrlParams(supportAccessGrantListQuery, { pageSizes: SUPPORT_ACCESS_PAGE_SIZE_OPTIONS, defaultLimit: SUPPORT_ACCESS_DEFAULT_PAGE_SIZE }),
		status: optionalUrlParam(SupportAccessGrantStatusSchema),
	},
	{ urlKeys: { status: listFilterKey("status") } },
);

export type SupportAccessUrlState = typeof SUPPORT_ACCESS_URL_STATE.defaults;

export type SupportAccessListFilter = Readonly<{ status: { eq: SupportAccessGrantStatus } | undefined }>;

/** The `GET /support-access` input for a URL state. */
export function toSupportAccessListQuery(state: SupportAccessUrlState): TableListQueryInput<SupportAccessListFilter> {
	return listStateToListQuery(supportAccessGrantListQuery, { pagination: state, sort: state.sort, filter: { status: eqFilter(state.status) } });
}
