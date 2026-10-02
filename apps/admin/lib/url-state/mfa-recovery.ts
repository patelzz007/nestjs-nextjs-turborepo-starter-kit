import { ALL_FILTER_OPTION, eqFilter, listStateToListQuery, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { listFilterKey, listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState, optionalUrlParam, urlParamWithDefault } from "@workspace/client/lib/url-state/url-state";
import { adminMfaRecoveryListQuery, AdminMfaRecoveryRequestSchema, MfaRecoveryRecordStatusSchema, type MfaRecoveryRecordStatus } from "@workspace/shared";
import { z } from "zod";

import { REVIEW_REQUEST_PARAM } from "@/lib/routes";

/** Page sizes the recovery queue offers. */
export const MFA_RECOVERY_PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50];
/** Default page size — omitted from the URL. */
export const MFA_RECOVERY_DEFAULT_PAGE_SIZE = 20;

/**
 * The queue opens on pending requests, so "every status" needs its own value:
 * `?filter[status]=all` (the admin filter selects' "no filter" option). It is
 * translated to "no status filter" before the API is called.
 */
export const MfaRecoveryStatusFilterSchema = z.union([MfaRecoveryRecordStatusSchema, z.literal(ALL_FILTER_OPTION)]);
export type MfaRecoveryStatusFilter = z.output<typeof MfaRecoveryStatusFilterSchema>;
/** The queue's default status filter — omitted from the URL. */
export const DEFAULT_MFA_RECOVERY_STATUS: MfaRecoveryStatusFilter = "PENDING";

/** `/users/mfa-recovery` state: the list keys of `GET /auth/admin/mfa/recovery/requests` plus `?requestId=` (the request in the review panel). */
export const MFA_RECOVERY_URL_STATE = defineUrlState(
	{
		...listUrlParams(adminMfaRecoveryListQuery, { pageSizes: MFA_RECOVERY_PAGE_SIZE_OPTIONS, defaultLimit: MFA_RECOVERY_DEFAULT_PAGE_SIZE }),
		status: urlParamWithDefault(MfaRecoveryStatusFilterSchema, DEFAULT_MFA_RECOVERY_STATUS),
		requestId: optionalUrlParam(AdminMfaRecoveryRequestSchema.shape.id),
	},
	{ urlKeys: { status: listFilterKey("status"), requestId: REVIEW_REQUEST_PARAM } },
);

export type MfaRecoveryUrlState = typeof MFA_RECOVERY_URL_STATE.defaults;

export type MfaRecoveryListFilter = Readonly<{ status: { eq: MfaRecoveryRecordStatus } | undefined }>;

/** The `GET /auth/admin/mfa/recovery/requests` input for a URL state. */
export function toMfaRecoveryListQuery(state: MfaRecoveryUrlState): TableListQueryInput<MfaRecoveryListFilter> {
	const status: MfaRecoveryRecordStatus | undefined = state.status === ALL_FILTER_OPTION ? undefined : state.status;
	return listStateToListQuery(adminMfaRecoveryListQuery, { pagination: state, sort: state.sort, filter: { status: eqFilter(status) } });
}
