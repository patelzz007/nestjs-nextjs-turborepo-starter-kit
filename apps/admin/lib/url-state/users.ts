import { z } from "zod";

import { eqFilter, listStateToListQuery, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { listFilterKey, listSearchParam, listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState, optionalUrlParam } from "@workspace/client/lib/url-state/url-state";
import {
	adminUserListQuery,
	AdminSignupReferralStatusFilterSchema,
	AdminUserStatusSchema,
	type AdminSignupReferralStatusFilter,
	type AdminUserStatus,
} from "@workspace/shared";

/** Page sizes the user table offers. */
export const USERS_PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];
/** Default page size — omitted from the URL. */
export const USERS_DEFAULT_PAGE_SIZE = 20;

/**
 * `/users` table state: `?page=&limit=&cursor=&sort=&search=&filter[status]=` —
 * the same keys `GET /auth/admin/users` takes (docs/technical/api/list-queries.md §7).
 */
export const USERS_TABLE_URL_STATE = defineUrlState(
	{
		...listUrlParams(adminUserListQuery, { pageSizes: USERS_PAGE_SIZE_OPTIONS, defaultLimit: USERS_DEFAULT_PAGE_SIZE }),
		search: listSearchParam(),
		status: optionalUrlParam(AdminUserStatusSchema),
		referrerId: optionalUrlParam(z.uuid()),
		referralStatus: optionalUrlParam(AdminSignupReferralStatusFilterSchema),
	},
	{ urlKeys: { status: listFilterKey("status"), referrerId: listFilterKey("referrerId"), referralStatus: listFilterKey("referralStatus") } },
);

export type UsersTableUrlState = typeof USERS_TABLE_URL_STATE.defaults;

export type UsersListFilter = Readonly<{
	status: { eq: AdminUserStatus } | undefined;
	referrerId: { eq: string } | undefined;
	referralStatus: { eq: AdminSignupReferralStatusFilter } | undefined;
}>;

/** The `GET /auth/admin/users` input for a URL state — used by the server page (prefetch) and the table (query). */
export function toUsersListQuery(state: UsersTableUrlState): TableListQueryInput<UsersListFilter> {
	return listStateToListQuery(adminUserListQuery, {
		pagination: state,
		sort: state.sort,
		search: state.search,
		filter: { status: eqFilter(state.status), referrerId: eqFilter(state.referrerId), referralStatus: eqFilter(state.referralStatus) },
	});
}
