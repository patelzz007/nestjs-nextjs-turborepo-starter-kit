"use client";

import type { ListSortSpec, SortColumnAliases } from "@workspace/client/lib/api/list-query";
import { LIST_FIRST_PAGE, listPagePatch, listSortToTableSorting, tableSortingToUrlSort, type ListUrlPagingState } from "@workspace/client/lib/url-state/list-url-state";
import type { DataTableServerPagination } from "@workspace/ui/lib/data-table/pagination";
import type { SortingState } from "@tanstack/react-table";
import * as React from "react";

/** A patch of the paging/sorting params (the table's `update` from `useUrlState` accepts it). */
export type ListUrlPagingPatch = Partial<ListUrlPagingState>;

export interface UrlListPagingOptions<TData extends object, TField extends string> {
	/** The table's URL state (its `page` / `limit` / `cursor` / `sort` fields). */
	readonly state: ListUrlPagingState;
	/** Writes a patch to the URL (pushes a history entry). */
	readonly update: (patch: ListUrlPagingPatch) => void;
	/** The resource's sort whitelist (`productListQuery`). */
	readonly sortSpec: ListSortSpec<TField>;
	/** Column id → API sort field, when they differ. Keep it stable (module-level). */
	readonly sortAliases?: SortColumnAliases<TField>;
	/** `meta.total` of the current response. */
	readonly totalCount: number;
	/** `meta.nextCursor` of the current response — reused for a sequential "next page". */
	readonly nextCursor: string | null;
	/** Changes whenever the result set changes (search, filters, sort), so the table drops its row selection. */
	readonly resetKey: string;
	readonly getRowId: (row: TData) => string;
	readonly onFetchAllMatching?: () => Promise<TData[]>;
	readonly onClearFilters?: () => void;
	readonly isFiltered?: boolean;
}

export interface UrlListPaging<TData extends object> {
	/** Server pagination for `DataTable`, driven by the URL. */
	readonly pagination: DataTableServerPagination<TData>;
	/** Controlled sorting for `DataTable`, derived from the URL's `sort`. */
	readonly sorting: SortingState;
	/** `DataTable#onManualSortingChange`: writes the sort to the URL and returns to page 1. */
	readonly handleSortingChange: (sorting: SortingState) => void;
}

const NO_SORT_ALIASES: SortColumnAliases<string> = {};

/**
 * Server pagination + sorting for an admin `DataTable` whose state lives in
 * the URL (lib/url-state). Page, page size and sort changes push a history
 * entry, so back/forward walks through them; a sort or page-size change
 * returns to page 1. A sequential "next" reuses the response's keyset
 * `cursor` (default order only — the API rejects a cursor with a custom sort);
 * any other jump pages by offset.
 */
export function useUrlListPaging<TData extends object, TField extends string>(options: UrlListPagingOptions<TData, TField>): UrlListPaging<TData> {
	const { state, update, sortSpec, sortAliases = NO_SORT_ALIASES, totalCount, nextCursor, resetKey, getRowId, onFetchAllMatching, onClearFilters, isFiltered } = options;
	const { page, limit, sort } = state;

	const sorting = React.useMemo((): SortingState => [...listSortToTableSorting(sort, sortAliases)], [sort, sortAliases]);

	const handleSortingChange = React.useCallback(
		(nextSorting: SortingState): void => {
			update({ sort: tableSortingToUrlSort(nextSorting, sortSpec, sortAliases), page: LIST_FIRST_PAGE, cursor: undefined });
		},
		[sortAliases, sortSpec, update],
	);

	const handlePageChange = React.useCallback(
		(nextPageIndex: number, nextPageSize: number): void => {
			if (nextPageSize !== limit) {
				update({ limit: nextPageSize, page: LIST_FIRST_PAGE, cursor: undefined });
				return;
			}
			update(listPagePatch(state, Math.max(0, nextPageIndex) + LIST_FIRST_PAGE, nextCursor));
		},
		[limit, nextCursor, state, update],
	);

	const pagination = React.useMemo(
		(): DataTableServerPagination<TData> => ({
			mode: "server",
			totalCount,
			pageIndex: page - LIST_FIRST_PAGE,
			pageSize: limit,
			onPageChange: handlePageChange,
			resetKey,
			getRowId,
			...(onFetchAllMatching !== undefined ? { onFetchAllMatching } : {}),
			...(onClearFilters !== undefined ? { onClearFilters } : {}),
			...(isFiltered !== undefined ? { isFiltered } : {}),
		}),
		[getRowId, handlePageChange, isFiltered, limit, onClearFilters, onFetchAllMatching, page, resetKey, totalCount],
	);

	return { pagination, sorting, handleSortingChange };
}
