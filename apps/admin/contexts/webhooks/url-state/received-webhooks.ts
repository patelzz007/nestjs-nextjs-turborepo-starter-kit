import { eqFilter, listStateToListQuery, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { listFilterKey, listSearchParam, listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState, optionalUrlParam } from "@workspace/client/lib/url-state/url-state";
import {
	ReceivedWebhookOutcomeSchema,
	ReceivedWebhookProviderSchema,
	ReceivedWebhookVerificationSchema,
	receivedWebhookListQuery,
	type ReceivedWebhookOutcome,
	type ReceivedWebhookProvider,
	type ReceivedWebhookVerification,
} from "@workspace/shared";

/** Page sizes the received-webhook log offers. */
export const RECEIVED_WEBHOOKS_PAGE_SIZE_OPTIONS: readonly number[] = [25, 50, 100];
/** Default page size — omitted from the URL. */
export const RECEIVED_WEBHOOKS_PAGE_SIZE = 50;

/** `/webhooks/received` table state — the keys of `GET /admin/webhooks/received` (ADR 081). */
export const RECEIVED_WEBHOOKS_URL_STATE = defineUrlState(
	{
		...listUrlParams(receivedWebhookListQuery, { pageSizes: RECEIVED_WEBHOOKS_PAGE_SIZE_OPTIONS, defaultLimit: RECEIVED_WEBHOOKS_PAGE_SIZE }),
		search: listSearchParam(),
		provider: optionalUrlParam(ReceivedWebhookProviderSchema),
		outcome: optionalUrlParam(ReceivedWebhookOutcomeSchema),
		verification: optionalUrlParam(ReceivedWebhookVerificationSchema),
	},
	{ urlKeys: { provider: listFilterKey("provider"), outcome: listFilterKey("outcome"), verification: listFilterKey("verification") } },
);

export type ReceivedWebhooksUrlState = typeof RECEIVED_WEBHOOKS_URL_STATE.defaults;

export type ReceivedWebhookListFilter = Readonly<{
	provider: { eq: ReceivedWebhookProvider } | undefined;
	outcome: { eq: ReceivedWebhookOutcome } | undefined;
	verification: { eq: ReceivedWebhookVerification } | undefined;
}>;

/** True when a filter or the search narrows the table. */
export function isReceivedWebhooksFiltered(state: ReceivedWebhooksUrlState): boolean {
	return state.search !== undefined || state.provider !== undefined || state.outcome !== undefined || state.verification !== undefined;
}

/** The `GET /admin/webhooks/received` input for a URL state (server prefetch and client query). */
export function toReceivedWebhookListQuery(state: ReceivedWebhooksUrlState): TableListQueryInput<ReceivedWebhookListFilter> {
	return listStateToListQuery(receivedWebhookListQuery, {
		pagination: state,
		sort: state.sort,
		search: state.search,
		filter: { provider: eqFilter(state.provider), outcome: eqFilter(state.outcome), verification: eqFilter(state.verification) },
	});
}
