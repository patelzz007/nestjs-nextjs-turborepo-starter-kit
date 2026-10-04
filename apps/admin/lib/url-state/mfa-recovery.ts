import { eqFilter, listStateToListQuery, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { listFilterKey, listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState, optionalUrlParam } from "@workspace/client/lib/url-state/url-state";
import { adminMfaRecoveryListQuery, AdminMfaRecoveryRequestSchema, MfaRecoveryRecordStatusSchema, type MfaRecoveryRecordStatus } from "@workspace/shared";

import { REVIEW_REQUEST_PARAM, ROUTES } from "@/lib/routes";

/** Page sizes the recovery queue offers. */
export const MFA_RECOVERY_PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50];
/** Default page size — omitted from the URL. */
export const MFA_RECOVERY_DEFAULT_PAGE_SIZE = 20;

/** `/users/mfa-recovery` state: the list keys of `GET /auth/admin/mfa/recovery/requests` plus `?requestId=` (the request in the review panel). */
export const MFA_RECOVERY_URL_STATE = defineUrlState(
	{
		...listUrlParams(adminMfaRecoveryListQuery, { pageSizes: MFA_RECOVERY_PAGE_SIZE_OPTIONS, defaultLimit: MFA_RECOVERY_DEFAULT_PAGE_SIZE }),
		// Absent = every status (the list grammar's "no filter"); a link that means "pending" says so.
		status: optionalUrlParam(MfaRecoveryRecordStatusSchema),
		requestId: optionalUrlParam(AdminMfaRecoveryRequestSchema.shape.id),
	},
	{ urlKeys: { status: listFilterKey("status"), requestId: REVIEW_REQUEST_PARAM } },
);

export type MfaRecoveryUrlState = typeof MFA_RECOVERY_URL_STATE.defaults;

export type MfaRecoveryListFilter = Readonly<{ status: { eq: MfaRecoveryRecordStatus } | undefined }>;

/** The `GET /auth/admin/mfa/recovery/requests` input for a URL state. */
export function toMfaRecoveryListQuery(state: MfaRecoveryUrlState): TableListQueryInput<MfaRecoveryListFilter> {
	return listStateToListQuery(adminMfaRecoveryListQuery, { pagination: state, sort: state.sort, filter: { status: eqFilter(state.status) } });
}

/** The queue filtered to requests awaiting review — what "review pending requests" links open. */
export const MFA_RECOVERY_PENDING_QUEUE_HREF: string = MFA_RECOVERY_URL_STATE.href(ROUTES.users.mfaRecovery, {
	...MFA_RECOVERY_URL_STATE.defaults,
	status: MfaRecoveryRecordStatusSchema.enum.PENDING,
});
