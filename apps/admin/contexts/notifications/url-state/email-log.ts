import { eqFilter, listStateToListQuery, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { listFilterKey, listSearchParam, listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState, optionalUrlParam } from "@workspace/client/lib/url-state/url-state";
import { emailLogListQuery, EmailLogStatusSchema, type EmailLogStatus } from "@workspace/shared";

/** Page sizes the email log offers. */
export const EMAIL_LOG_PAGE_SIZE_OPTIONS: readonly number[] = [10, 25, 50, 100];
/** Default page size — omitted from the URL. */
export const EMAIL_LOG_PAGE_SIZE = 25;

/** `/emails/log` table state — the keys of `GET /notifications/email-log`. */
export const EMAIL_LOG_URL_STATE = defineUrlState(
	{
		...listUrlParams(emailLogListQuery, { pageSizes: EMAIL_LOG_PAGE_SIZE_OPTIONS, defaultLimit: EMAIL_LOG_PAGE_SIZE }),
		search: listSearchParam(),
		status: optionalUrlParam(EmailLogStatusSchema),
	},
	{ urlKeys: { status: listFilterKey("status") } },
);

export type EmailLogUrlState = typeof EMAIL_LOG_URL_STATE.defaults;

export type EmailLogListFilter = Readonly<{ status: { eq: EmailLogStatus } | undefined }>;

/** The `GET /notifications/email-log` input for a URL state (server prefetch and client query). */
export function toEmailLogListQuery(state: EmailLogUrlState): TableListQueryInput<EmailLogListFilter> {
	return listStateToListQuery(emailLogListQuery, { pagination: state, sort: state.sort, search: state.search, filter: { status: eqFilter(state.status) } });
}
