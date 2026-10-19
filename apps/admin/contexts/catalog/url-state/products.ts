import { eqFilter, listStateToListQuery, parseFilterOption, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { listFilterKey, listSearchParam, listTextFilterParam, listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState, optionalBooleanUrlParam } from "@workspace/client/lib/url-state/url-state";
import { FilterUuidValueSchema, productListQuery } from "@workspace/shared";

/** Page sizes the product table offers. */
export const PRODUCTS_PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];
/** Default page size — omitted from the URL. */
export const PRODUCTS_DEFAULT_PAGE_SIZE = 20;

/**
 * `/catalog/products` table state — the keys of `GET /product`:
 * `filter[isActive]`, `filter[isFeatured]`, `filter[categoryId]` and
 * `filter[brand][contains]`. The two free-text filters keep whatever the user
 * typed (so a half-typed id survives a reload); a category id is only sent once
 * it is a valid UUID.
 */
export const PRODUCTS_TABLE_URL_STATE = defineUrlState(
	{
		...listUrlParams(productListQuery, { pageSizes: PRODUCTS_PAGE_SIZE_OPTIONS, defaultLimit: PRODUCTS_DEFAULT_PAGE_SIZE }),
		search: listSearchParam(),
		isActive: optionalBooleanUrlParam(),
		isFeatured: optionalBooleanUrlParam(),
		categoryId: listTextFilterParam(),
		brand: listTextFilterParam(),
	},
	{
		urlKeys: {
			isActive: listFilterKey("isActive"),
			isFeatured: listFilterKey("isFeatured"),
			categoryId: listFilterKey("categoryId"),
			brand: listFilterKey("brand", "contains"),
		},
	},
);

export type ProductsTableUrlState = typeof PRODUCTS_TABLE_URL_STATE.defaults;

export type ProductsListFilter = Readonly<{
	isActive: { eq: boolean } | undefined;
	isFeatured: { eq: boolean } | undefined;
	categoryId: { eq: string } | undefined;
	brand: { contains: string } | undefined;
}>;

/** The `GET /product` input for a URL state (server prefetch, client query and "select all matching"). */
export function toProductsListQuery(state: ProductsTableUrlState): TableListQueryInput<ProductsListFilter> {
	return listStateToListQuery(productListQuery, {
		pagination: state,
		sort: state.sort,
		search: state.search,
		filter: {
			isActive: eqFilter(state.isActive),
			isFeatured: eqFilter(state.isFeatured),
			categoryId: eqFilter(parseFilterOption(state.categoryId ?? "", FilterUuidValueSchema)),
			brand: state.brand !== undefined ? { contains: state.brand } : undefined,
		},
	});
}
