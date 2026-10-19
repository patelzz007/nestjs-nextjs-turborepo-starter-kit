import { eqFilter, listStateToListQuery, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { listFilterKey, listSearchParam, listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState, optionalBooleanUrlParam } from "@workspace/client/lib/url-state/url-state";
import { sampleCategoryListQuery } from "@workspace/shared";

/** Page sizes the category table offers. */
export const CATEGORIES_PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];
/** Default page size — omitted from the URL. */
export const CATEGORIES_DEFAULT_PAGE_SIZE = 20;

/** `/catalog/categories` table state — the keys of `GET /sample-category`. */
export const CATEGORIES_TABLE_URL_STATE = defineUrlState(
	{
		...listUrlParams(sampleCategoryListQuery, { pageSizes: CATEGORIES_PAGE_SIZE_OPTIONS, defaultLimit: CATEGORIES_DEFAULT_PAGE_SIZE }),
		search: listSearchParam(),
		isActive: optionalBooleanUrlParam(),
	},
	{ urlKeys: { isActive: listFilterKey("isActive") } },
);

export type CategoriesTableUrlState = typeof CATEGORIES_TABLE_URL_STATE.defaults;

export type CategoriesListFilter = Readonly<{ isActive: { eq: boolean } | undefined }>;

/** The `GET /sample-category` input for a URL state (server prefetch and client query). */
export function toCategoriesListQuery(state: CategoriesTableUrlState): TableListQueryInput<CategoriesListFilter> {
	return listStateToListQuery(sampleCategoryListQuery, { pagination: state, sort: state.sort, search: state.search, filter: { isActive: eqFilter(state.isActive) } });
}
