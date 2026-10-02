// ============================================
// lib/api/list-query.ts - table state → list query (docs/list-queries.md)
// ============================================
// Server-side tables keep TanStack Table state (sorting, page, column-filter
// selections) and must turn it into the list grammar the API accepts. These
// adapters do that WITHOUT trusting the table: a sort column that is not in
// the resource's whitelist is dropped (so a UI-only column can never produce a
// 400), filter selections are parsed through the field's own zod schema, and
// the result is a plain input the typed client validates again before sending.
//
// They are structural (no `@tanstack/react-table` import) so `packages/ui`'s
// DataTable stays data-agnostic and this package stays framework-light.

import { formatSortParam, LIST_MAX_SORT_TERMS, LIST_VALUE_SEPARATOR, SORT_DESCENDING_PREFIX, type DataValue, type SortTerm } from "@workspace/shared";
import type { ZodType } from "zod";

/** One entry of TanStack Table's `SortingState` (`{ id: columnId, desc }`). */
export interface TableSortingEntry {
	readonly id: string;
	readonly desc: boolean;
}

/** Maps a table column id to the API sort field it sorts by (`{ countryCode: "iso2" }`); unmapped ids are used as-is. */
export type SortColumnAliases<TField extends string> = Readonly<Partial<Record<string, TField>>>;

/**
 * TanStack sorting → the `sort` parameter (`-createdAt,name`), or `undefined`
 * for the resource default. Columns outside `sortable` are ignored and at most
 * {@link LIST_MAX_SORT_TERMS} keys are sent.
 */
export function tableSortingToListSort<TField extends string>(
	sorting: readonly TableSortingEntry[],
	sortable: readonly TField[],
	aliases: SortColumnAliases<TField> = {},
): string | undefined {
	const terms: SortTerm<TField>[] = [];
	for (const entry of sorting) {
		const candidate: string = aliases[entry.id] ?? entry.id;
		const field: TField | undefined = sortable.find((allowed: TField): boolean => allowed === candidate);
		if (field === undefined || terms.some((term: SortTerm<TField>): boolean => term.field === field)) continue;
		terms.push({ field, direction: entry.desc ? "desc" : "asc" });
		if (terms.length === LIST_MAX_SORT_TERMS) break;
	}
	return terms.length > 0 ? formatSortParam(terms) : undefined;
}

/**
 * A `sort` param (`-createdAt,name`) → TanStack sorting entries, WITHOUT
 * validation: the entries go back through {@link tableSortingToListSort}'s
 * whitelist before anything is sent, so unknown or repeated fields are dropped
 * there. Empty keys are skipped; a missing param is the default order (`[]`).
 */
export function sortParamToTableSorting(sort: string | undefined): readonly TableSortingEntry[] {
	if (sort === undefined) return [];
	return sort
		.split(LIST_VALUE_SEPARATOR)
		.map((token: string): string => token.trim())
		.map((token: string): TableSortingEntry => {
			const desc: boolean = token.startsWith(SORT_DESCENDING_PREFIX);
			return { id: desc ? token.slice(SORT_DESCENDING_PREFIX.length) : token, desc };
		})
		.filter((entry: TableSortingEntry): boolean => entry.id.length > 0);
}

/** Sentinel the admin filter selects use for "no filter". */
export const ALL_FILTER_OPTION = "all";

/**
 * A select / input filter value → the typed filter value, or `undefined` when
 * the control is empty, set to {@link ALL_FILTER_OPTION}, or holds a value the
 * field's schema rejects (it is then simply not sent).
 */
export function parseFilterOption<T>(value: string, schema: ZodType<T>): T | undefined {
	const trimmed: string = value.trim();
	if (trimmed.length === 0 || trimmed === ALL_FILTER_OPTION) return undefined;
	const parsed = schema.safeParse(trimmed);
	return parsed.success ? parsed.data : undefined;
}

/** `"true"` / `"false"` select values → boolean; anything else (incl. "all") → `undefined`. */
export function parseBooleanFilterOption(value: string): boolean | undefined {
	if (value === "true") return true;
	if (value === "false") return false;
	return undefined;
}

/** Trimmed search text, or `undefined` when blank (the API rejects an empty `search`). */
export function toListSearch(value: string): string | undefined {
	const trimmed: string = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

/** `{ eq: value }`, or `undefined` when there is no value — the shape of a single-value filter field. */
export function eqFilter<T>(value: T | undefined): { readonly eq: T } | undefined {
	return value === undefined ? undefined : { eq: value };
}

// ── DataTable state → list query ───────────────────────────────────────────

/** The sort half of a resource's list-query definition (`productListQuery` satisfies it). */
export interface ListSortSpec<TField extends string> {
	readonly sortable: readonly TField[];
	readonly defaultSort: readonly SortTerm<TField>[];
}

/** Pagination state as the hybrid pagination hooks expose it. */
export interface TablePaginationState {
	readonly page: number;
	readonly limit: number;
	readonly cursor?: string | undefined;
}

/** A filter object: whitelisted field → operator object (or `undefined` when the control is empty). */
export type TableFilterState = Readonly<Record<string, DataValue | undefined>>;

export interface TableListState<TField extends string, TFilter extends TableFilterState> {
	readonly pagination: TablePaginationState;
	/** TanStack Table `SortingState`. */
	readonly sorting: readonly TableSortingEntry[];
	readonly sortAliases?: SortColumnAliases<TField> | undefined;
	/** Raw search box text (trimmed; blank is not sent). */
	readonly search?: string | undefined;
	readonly filter?: TFilter | undefined;
}

/**
 * The list-query input for one table state. Keys are only present when they
 * carry a value, so the input passes the resource's strict schema and the
 * react-query key only changes when the request does.
 */
export interface TableListQueryInput<TFilter extends TableFilterState> {
	readonly page: number;
	readonly limit: number;
	readonly cursor?: string;
	readonly sort?: string;
	readonly search?: string;
	readonly filter?: TFilter;
	/** Index signature so the input is a `SerializableInput` (see `Envelope` for the same pattern). */
	readonly [key: string]: DataValue | undefined;
}

function hasActiveFilter(filter: TableFilterState): boolean {
	return Object.values(filter).some((value: DataValue | undefined): boolean => value !== undefined);
}

/**
 * DataTable state (pagination + sorting + search + filters) → the list query
 * the typed client sends. Sorting goes through {@link tableSortingToListSort}
 * (whitelist only); the resource's default order is sent as "no sort", and a
 * keyset `cursor` is only kept while the default order is in effect — the API
 * rejects a cursor combined with a custom sort, so a custom sort pages by
 * `page` alone.
 */
export function tableStateToListQuery<TField extends string, TFilter extends TableFilterState>(
	spec: ListSortSpec<TField>,
	state: TableListState<TField, TFilter>,
): TableListQueryInput<TFilter> {
	const requestedSort: string | undefined = tableSortingToListSort(state.sorting, spec.sortable, state.sortAliases ?? {});
	const sort: string | undefined = requestedSort === formatSortParam(spec.defaultSort) ? undefined : requestedSort;
	const cursor: string | undefined = sort === undefined ? state.pagination.cursor : undefined;
	const search: string | undefined = state.search === undefined ? undefined : toListSearch(state.search);
	const filter: TFilter | undefined = state.filter !== undefined && hasActiveFilter(state.filter) ? state.filter : undefined;
	return {
		page: state.pagination.page,
		limit: state.pagination.limit,
		...(cursor !== undefined ? { cursor } : {}),
		...(sort !== undefined ? { sort } : {}),
		...(search !== undefined ? { search } : {}),
		...(filter !== undefined ? { filter } : {}),
	};
}

/** List state as a URL holds it (lib/url-state): the `sort` param instead of TanStack sorting. */
export interface UrlListState<TFilter extends TableFilterState> {
	readonly pagination: TablePaginationState;
	/** The URL's `sort` param (API field names); `undefined` = the resource default. */
	readonly sort: string | undefined;
	readonly search?: string | undefined;
	readonly filter?: TFilter | undefined;
}

/**
 * URL list state → the list-query input. Same rules as
 * {@link tableStateToListQuery} (whitelisted sort only, default order sent as
 * "no sort", cursor only with the default order, blank search / empty filters
 * omitted) — a server page and the client table build the identical input
 * from the same URL, so the prefetched page and the client query share a key.
 */
export function listStateToListQuery<TField extends string, TFilter extends TableFilterState>(
	spec: ListSortSpec<TField>,
	state: UrlListState<TFilter>,
): TableListQueryInput<TFilter> {
	return tableStateToListQuery(spec, {
		pagination: state.pagination,
		sorting: sortParamToTableSorting(state.sort),
		search: state.search,
		filter: state.filter,
	});
}
