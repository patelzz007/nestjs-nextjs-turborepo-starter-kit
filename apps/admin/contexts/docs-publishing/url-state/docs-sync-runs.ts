import { eqFilter, listStateToListQuery, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { listFilterKey, listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState, optionalUrlParam } from "@workspace/client/lib/url-state/url-state";
import { docsSyncRunListQuery, DocsSyncRunStatusSchema, DocsSyncTriggerSchema, type DocsSyncRunStatus, type DocsSyncTrigger } from "@workspace/shared";

/** Page sizes the run history offers. */
export const DOCS_SYNC_RUNS_PAGE_SIZE_OPTIONS: readonly number[] = [25, 50, 100];
/** Default page size — omitted from the URL. */
export const DOCS_SYNC_RUNS_PAGE_SIZE = 25;

/** `/operations/docs-sync` table state — the keys of `GET /admin/docs-publishing/runs` (ADR 084). */
export const DOCS_SYNC_RUNS_URL_STATE = defineUrlState(
	{
		...listUrlParams(docsSyncRunListQuery, { pageSizes: DOCS_SYNC_RUNS_PAGE_SIZE_OPTIONS, defaultLimit: DOCS_SYNC_RUNS_PAGE_SIZE }),
		status: optionalUrlParam(DocsSyncRunStatusSchema),
		trigger: optionalUrlParam(DocsSyncTriggerSchema),
	},
	{ urlKeys: { status: listFilterKey("status"), trigger: listFilterKey("trigger") } },
);

export type DocsSyncRunsUrlState = typeof DOCS_SYNC_RUNS_URL_STATE.defaults;

export type DocsSyncRunListFilter = Readonly<{
	status: { eq: DocsSyncRunStatus } | undefined;
	trigger: { eq: DocsSyncTrigger } | undefined;
}>;

/** True when a filter narrows the table. */
export function isDocsSyncRunsFiltered(state: DocsSyncRunsUrlState): boolean {
	return state.status !== undefined || state.trigger !== undefined;
}

/** The `GET /admin/docs-publishing/runs` input for a URL state (server prefetch and client query). */
export function toDocsSyncRunListQuery(state: DocsSyncRunsUrlState): TableListQueryInput<DocsSyncRunListFilter> {
	return listStateToListQuery(docsSyncRunListQuery, {
		pagination: state,
		sort: state.sort,
		filter: { status: eqFilter(state.status), trigger: eqFilter(state.trigger) },
	});
}
