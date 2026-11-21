"use client";

import type { ListSortSpec, SortColumnAliases } from "@workspace/client/lib/api/list-query";
import { LIST_FIRST_PAGE, listPagePatch, listSortToTableSorting, tableSortingToUrlSort, type ListUrlPagingState } from "@workspace/client/lib/url-state/list-url-state";
import { isStringPrimitive } from "@workspace/shared";
import type { DataTableFilterValues, DataTableQuery, DataTableQueryChange, DataTableServerSource } from "@workspace/ui/components/data-table";
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
	/**
	 * The table's select filters as the URL holds them, by filter column. A value of `"all"` or `""` means the filter
	 * is not set. Keep the object stable (`useMemo`).
	 */
	readonly filters?: Readonly<Record<string, string>>;
	/** A filter changed: write it to the URL. `null` means "All". */
	readonly onFilterChange?: (column: string, value: string | null) => void;
	/** The committed search text of the page's own search box, so the table knows the rows are narrowed. */
	readonly search?: string;
	/** Whether anything in the URL narrows the rows (the search, a select filter or a free-text filter of the page's own). */
	readonly isFiltered?: boolean;
	/** "Clear filters" was pressed on the table's "no results" state: reset the search and every filter in the URL. */
	readonly onClearFilters?: () => void;
	/** A row's stable id. Handed back as `getRowId`, so the table and its source agree on the row type. */
	readonly getRowId: (row: TData) => string;
	/** Fetches every matching row, for "select all matching rows" and for exporting more than the page. */
	readonly onFetchAllMatching?: () => Promise<TData[]>;
}

/** The two props that make a `DataTable` a server table of this URL: `<DataTable source={source} getRowId={getRowId} … />`. */
export interface UrlListPaging<TData extends object> {
	/** `DataTable`'s `source`: a server table whose page, page size, sort and filters live in the URL. */
	readonly source: DataTableServerSource<TData>;
	/** `DataTable`'s `getRowId`. */
	readonly getRowId: (row: TData) => string;
}

const NO_SORT_ALIASES: SortColumnAliases<string> = {};
const NO_FILTERS: Readonly<Record<string, string>> = {};

/** The value a select filter's "All" choice has in the URL state of the admin tables. */
const FILTER_ALL_VALUE = "all";

/** The filters that are actually set: an unset one has no entry in the table's query. */
function toQueryFilters(filters: Readonly<Record<string, string>>): DataTableFilterValues {
	return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== "" && value !== FILTER_ALL_VALUE));
}

/**
 * The server `source` of an admin `DataTable` whose state lives in the URL (lib/url-state). Page, page size and sort
 * changes push a history entry, so back/forward walks through them; a sort or page-size change returns to page 1. A
 * sequential "next" reuses the response's keyset `cursor` (default order only — the API rejects a cursor with a
 * custom sort); any other jump pages by offset. Filter changes are handed to `onFilterChange`, because each table
 * validates its own filter values.
 */
export function useUrlListPaging<TData extends object, TField extends string>(options: UrlListPagingOptions<TData, TField>): UrlListPaging<TData> {
	const {
		state,
		update,
		sortSpec,
		sortAliases = NO_SORT_ALIASES,
		totalCount,
		nextCursor,
		filters = NO_FILTERS,
		onFilterChange,
		search = "",
		isFiltered = false,
		onClearFilters,
		getRowId,
		onFetchAllMatching,
	} = options;
	const { page, limit, sort } = state;

	const query = React.useMemo(
		(): DataTableQuery => ({
			pageIndex: page - LIST_FIRST_PAGE,
			pageSize: limit,
			sorting: [...listSortToTableSorting(sort, sortAliases)],
			filters: toQueryFilters(filters),
			search,
		}),
		[page, limit, sort, sortAliases, filters, search],
	);

	const handleQueryChange = React.useCallback(
		(next: DataTableQuery, change: DataTableQueryChange): void => {
			switch (change.kind) {
				case "page":
					update(listPagePatch(state, Math.max(0, next.pageIndex) + LIST_FIRST_PAGE, nextCursor));
					return;
				case "page-size":
					update({ limit: next.pageSize, page: LIST_FIRST_PAGE, cursor: undefined });
					return;
				case "sorting":
					update({ sort: tableSortingToUrlSort(next.sorting, sortSpec, sortAliases), page: LIST_FIRST_PAGE, cursor: undefined });
					return;
				case "filter":
					onFilterChange?.(change.column, isStringPrimitive(change.value) ? change.value : null);
					return;
				case "clear-filters":
					onClearFilters?.();
					return;
				case "search":
					// The admin tables own their search box (in the toolbar's `extra` slot) and write it to the URL themselves.
					return;
				default:
					assertNeverQueryChange(change);
			}
		},
		[nextCursor, onClearFilters, onFilterChange, sortAliases, sortSpec, state, update],
	);

	const source = React.useMemo(
		(): DataTableServerSource<TData> => ({
			mode: "server",
			totalCount,
			query,
			onQueryChange: handleQueryChange,
			isFiltered,
			...(onFetchAllMatching === undefined ? {} : { onFetchAllMatching }),
		}),
		[handleQueryChange, isFiltered, onFetchAllMatching, query, totalCount],
	);

	return { source, getRowId };
}

function assertNeverQueryChange(value: never): never {
	throw new Error(`Unhandled table query change: ${JSON.stringify(value)}`);
}
