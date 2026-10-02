// ============================================
// lib/url-state/list-url-state.ts - list-grammar params for URL state
// ============================================
// A server-side table's URL speaks the SAME grammar as the list endpoint it
// reads (docs/list-queries.md, ADR 021): `page`, `limit`, `cursor`, `sort`,
// `search` and `filter[field]` mean in the address bar exactly what they mean
// to the API, so a table URL maps 1:1 onto the list input and a bookmarked or
// shared link reproduces the same request.
//
// These builders produce the param schemas for `defineUrlState`:
//
//   export const USERS_URL_STATE = defineUrlState(
//     {
//       ...listUrlParams(adminUserListQuery, { pageSizes: [10, 20, 50, 100], defaultLimit: 20 }),
//       search: listSearchParam(),
//       status: optionalUrlParam(AdminUserStatusSchema),
//     },
//     { urlKeys: { status: listFilterKey("status") } },
//   );
//
// The URL state is then turned into the list input with `listStateToListQuery`
// (../api/list-query), which re-applies the sort whitelist and cursor rules.
//
// Server-safe (no "use client").

import {
	formatSortParam,
	LIST_MAX_CURSOR_LENGTH,
	LIST_MAX_FILTER_TEXT_LENGTH,
	LIST_MAX_LIMIT,
	LIST_MAX_PAGE,
	LIST_MAX_SEARCH_LENGTH,
	LIST_MAX_SORT_LENGTH,
	parseSortParam,
	type ListFilterOperator,
	type SortParseResult,
} from "@workspace/shared";
import { z } from "zod";

import { sortParamToTableSorting, tableSortingToListSort, type ListSortSpec, type SortColumnAliases, type TableSortingEntry } from "../api/list-query";
import { InvalidUrlStateDefinitionError, type UrlParamSchema } from "./url-state";

/** The first page of every list (offset pages are 1-indexed). */
export const LIST_FIRST_PAGE = 1;

/** The paging/sorting half of a list table's URL state. */
export interface ListUrlPagingState {
	readonly page: number;
	readonly limit: number;
	/** Opaque keyset cursor of `page` (sequential "next" only, default order only). */
	readonly cursor: string | undefined;
	/** Normalized sort param (`-email,fullName`); `undefined` = the resource's default order. */
	readonly sort: string | undefined;
}

/** The page half of a list URL state patch — what a page move writes. */
export interface ListUrlPagePatch {
	readonly page: number;
	readonly cursor: string | undefined;
}

/**
 * The patch that moves a list from `state` to `page`. A sequential "next" in
 * the default order reuses the current response's keyset `nextCursor` (the API
 * rejects a cursor combined with a custom sort); any other move — back, a
 * jump, or "next" under a custom sort — pages by offset and drops the cursor.
 */
export function listPagePatch(state: ListUrlPagingState, page: number, nextCursor: string | null): ListUrlPagePatch {
	if (nextCursor !== null && page === state.page + 1 && state.sort === undefined) {
		return { page, cursor: nextCursor };
	}
	return { page, cursor: undefined };
}

/** Param schemas of {@link ListUrlPagingState}, to spread into a `defineUrlState` shape. */
export interface ListUrlParamsShape {
	readonly page: UrlParamSchema<number>;
	readonly limit: UrlParamSchema<number>;
	readonly cursor: UrlParamSchema<string | undefined>;
	readonly sort: UrlParamSchema<string | undefined>;
}

export interface ListUrlParamsOptions {
	/** The page sizes the table offers; `limit` outside this list falls back to `defaultLimit`. */
	readonly pageSizes: readonly number[];
	/** The table's default page size — omitted from the URL. Must be one of `pageSizes`. */
	readonly defaultLimit: number;
}

/**
 * `?filter[field]` (shorthand for `eq`) or `?filter[field][op]` — the URL key of
 * one list filter, identical to the API's query key.
 */
export function listFilterKey(field: string, operator?: ListFilterOperator): string {
	return operator === undefined || operator === "eq" ? `filter[${field}]` : `filter[${field}][${operator}]`;
}

/**
 * The resource's sort whitelist applied to a raw `sort` param: the normalized
 * param (`-createdAt,name`), or `undefined` for a missing, invalid or default
 * order — so the default order never shows up in the URL.
 */
export function normalizeListSortParam<TField extends string>(raw: string | undefined, spec: ListSortSpec<TField>): string | undefined {
	if (raw === undefined) return undefined;
	const parsed: SortParseResult<TField> = parseSortParam(raw, spec.sortable);
	if (!parsed.success) return undefined;
	const formatted: string = formatSortParam(parsed.terms);
	return formatted === formatSortParam(spec.defaultSort) ? undefined : formatted;
}

/**
 * `page`, `limit`, `cursor` and `sort` param schemas for one list resource.
 * Throws at definition time when the page sizes are not valid list limits.
 */
export function listUrlParams<TField extends string>(spec: ListSortSpec<TField>, options: ListUrlParamsOptions): ListUrlParamsShape {
	const invalidSizes: readonly number[] = options.pageSizes.filter((size: number): boolean => !Number.isInteger(size) || size < 1 || size > LIST_MAX_LIMIT);
	if (invalidSizes.length > 0 || options.pageSizes.length === 0) {
		throw new InvalidUrlStateDefinitionError(`listUrlParams: page sizes must be whole numbers from 1 to ${String(LIST_MAX_LIMIT)} (got ${options.pageSizes.join(", ")})`);
	}
	if (!options.pageSizes.includes(options.defaultLimit)) {
		throw new InvalidUrlStateDefinitionError(`listUrlParams: the default page size ${String(options.defaultLimit)} is not one of ${options.pageSizes.join(", ")}`);
	}
	return {
		page: z.coerce.number().int().min(LIST_FIRST_PAGE).max(LIST_MAX_PAGE).catch(LIST_FIRST_PAGE),
		limit: z.coerce
			.number()
			.int()
			.refine((limit: number): boolean => options.pageSizes.includes(limit))
			.catch(options.defaultLimit),
		cursor: z.string().min(1).max(LIST_MAX_CURSOR_LENGTH).optional().catch(undefined),
		sort: z
			.string()
			.max(LIST_MAX_SORT_LENGTH)
			.transform((raw: string): string | undefined => normalizeListSortParam(raw, spec))
			.optional()
			.catch(undefined),
	};
}

/** The free-text `search` param: trimmed, 1–{@link LIST_MAX_SEARCH_LENGTH} characters, otherwise absent. */
export function listSearchParam(): UrlParamSchema<string | undefined> {
	return z.string().trim().min(1).max(LIST_MAX_SEARCH_LENGTH).optional().catch(undefined);
}

/** A free-text filter value (`filter[brand][contains]=…`): trimmed, 1–{@link LIST_MAX_FILTER_TEXT_LENGTH} characters, otherwise absent. */
export function listTextFilterParam(): UrlParamSchema<string | undefined> {
	return z.string().trim().min(1).max(LIST_MAX_FILTER_TEXT_LENGTH).optional().catch(undefined);
}

/**
 * The URL `sort` param → TanStack `SortingState` for the table's header
 * indicators. `aliases` maps a column id to the API field it sorts by
 * (`{ countryCode: "iso2" }`); here it is applied in reverse, so the indicator
 * lands on the column the user clicked.
 */
export function listSortToTableSorting<TField extends string>(sort: string | undefined, aliases: SortColumnAliases<TField> = {}): readonly TableSortingEntry[] {
	const columnForField = new Map<string, string>();
	for (const [columnId, field] of Object.entries(aliases)) {
		if (field !== undefined && !columnForField.has(field)) {
			columnForField.set(field, columnId);
		}
	}
	return sortParamToTableSorting(sort).map((entry: TableSortingEntry): TableSortingEntry => ({ id: columnForField.get(entry.id) ?? entry.id, desc: entry.desc }));
}

/** TanStack `SortingState` → the normalized URL `sort` param (`undefined` for the resource's default order). */
export function tableSortingToUrlSort<TField extends string>(
	sorting: readonly TableSortingEntry[],
	spec: ListSortSpec<TField>,
	aliases: SortColumnAliases<TField> = {},
): string | undefined {
	return normalizeListSortParam(tableSortingToListSort(sorting, spec.sortable, aliases), spec);
}
