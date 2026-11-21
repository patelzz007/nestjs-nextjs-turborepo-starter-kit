// What a server-driven DataTable asks its parent for, shared by the web and native kits: ONE query object (page, page
// size, sort, filters, search) and the reason it changed. The parent owns it (usually in the URL) and refetches.

import { isArrayValue, isStringPrimitive } from "@workspace/shared";

import type { DataTableSorting } from "./prefs";

/** An inclusive date range a `date-range` filter holds. Each bound is an ISO date (`2026-11-19`) or `null` for open. */
export interface DataTableDateRange {
	readonly from: string | null;
	readonly to: string | null;
}

/** One filter's value: the chosen option (`select`), the chosen options (`multi-select`) or a range (`date-range`). */
export type DataTableFilterValue = string | readonly string[] | DataTableDateRange;

/** Every active filter, by the filter's `column`. A filter that is not set has no entry. */
export type DataTableFilterValues = Readonly<Record<string, DataTableFilterValue>>;

/** Everything a server-driven table needs fetched. `pageIndex` starts at 0. */
export interface DataTableQuery {
	readonly pageIndex: number;
	readonly pageSize: number;
	readonly sorting: DataTableSorting;
	readonly filters: DataTableFilterValues;
	readonly search: string;
}

/** Why the query changed, so the parent can write only the part of its own state that moved. */
export type DataTableQueryChange =
	| { readonly kind: "page" }
	| { readonly kind: "page-size" }
	| { readonly kind: "sorting" }
	| { readonly kind: "search" }
	| { readonly kind: "filter"; readonly column: string; readonly value: DataTableFilterValue | null }
	| { readonly kind: "clear-filters" };

/** The first page: where a change to the sort, the search, a filter or the page size returns to. */
export const DATA_TABLE_FIRST_PAGE_INDEX = 0;

/** A query with nothing set, for a table that starts on page one with no sort and no filters. */
export function createDataTableQuery(pageSize: number): DataTableQuery {
	return { pageIndex: DATA_TABLE_FIRST_PAGE_INDEX, pageSize, sorting: [], filters: {}, search: "" };
}

/** `true` for a value that filters nothing: an empty choice, an empty list or a range with both ends open. */
export function isEmptyDataTableFilterValue(value: DataTableFilterValue | null | undefined): boolean {
	if (value === null || value === undefined) {
		return true;
	}
	if (isStringPrimitive(value)) {
		return value === "";
	}
	if (isArrayValue(value)) {
		return value.length === 0;
	}
	return value.from === null && value.to === null;
}

/** `filters` with one column set, or removed when the value filters nothing. */
export function setDataTableFilterValue(filters: DataTableFilterValues, column: string, value: DataTableFilterValue | null): DataTableFilterValues {
	const next: Record<string, DataTableFilterValue> = {};
	for (const [key, current] of Object.entries(filters)) {
		if (key !== column) {
			next[key] = current;
		}
	}
	if (value !== null && !isEmptyDataTableFilterValue(value)) {
		next[column] = value;
	}
	return next;
}

/** Whether the query narrows the result set (a search or any filter). */
export function isDataTableQueryFiltered(query: DataTableQuery): boolean {
	return query.search !== "" || Object.values(query.filters).some((value) => !isEmptyDataTableFilterValue(value));
}

/** The query after a page move. */
export function withDataTablePage(query: DataTableQuery, pageIndex: number): DataTableQuery {
	return { ...query, pageIndex: Math.max(DATA_TABLE_FIRST_PAGE_INDEX, pageIndex) };
}

/** The query after a page-size change: back on the first page. */
export function withDataTablePageSize(query: DataTableQuery, pageSize: number): DataTableQuery {
	return { ...query, pageSize, pageIndex: DATA_TABLE_FIRST_PAGE_INDEX };
}

/** The query after a sort change: back on the first page. */
export function withDataTableSorting(query: DataTableQuery, sorting: DataTableSorting): DataTableQuery {
	return { ...query, sorting, pageIndex: DATA_TABLE_FIRST_PAGE_INDEX };
}

/** The query after a search change: back on the first page. */
export function withDataTableSearch(query: DataTableQuery, search: string): DataTableQuery {
	return { ...query, search, pageIndex: DATA_TABLE_FIRST_PAGE_INDEX };
}

/** The query after one filter changed: back on the first page. */
export function withDataTableFilter(query: DataTableQuery, column: string, value: DataTableFilterValue | null): DataTableQuery {
	return { ...query, filters: setDataTableFilterValue(query.filters, column, value), pageIndex: DATA_TABLE_FIRST_PAGE_INDEX };
}

/** The query with the search and every filter cleared: back on the first page. */
export function withDataTableFiltersCleared(query: DataTableQuery): DataTableQuery {
	return { ...query, filters: {}, search: "", pageIndex: DATA_TABLE_FIRST_PAGE_INDEX };
}

/** The 1-based first and last row a page shows, and how many pages there are. */
export interface DataTablePageRange {
	readonly from: number;
	readonly to: number;
	readonly pageCount: number;
}

/** A table always has one page, even an empty one. */
const MIN_PAGE_COUNT = 1;

/** The rows a page shows out of `totalCount`. An empty table shows `0 to 0`. */
export function getDataTablePageRange(pageIndex: number, pageSize: number, totalCount: number): DataTablePageRange {
	const safePageSize = Math.max(1, pageSize);
	const pageCount = Math.max(MIN_PAGE_COUNT, Math.ceil(totalCount / safePageSize));
	if (totalCount <= 0) {
		return { from: 0, to: 0, pageCount };
	}
	return { from: pageIndex * safePageSize + 1, to: Math.min((pageIndex + 1) * safePageSize, totalCount), pageCount };
}
