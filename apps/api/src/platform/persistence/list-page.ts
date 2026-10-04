// ============================================
// platform/persistence/list-page.ts - the ONE offset + keyset list implementation
// ============================================
// Every paginated repository list goes through `fetchListPage`:
//
//   - offset mode (`page`): `orderBy` is the requested sort (or the default)
//     plus a unique tie-breaker, so pages never overlap or skip rows;
//   - keyset mode (`cursor`): rows strictly after the cursor's position in the
//     resource's DEFAULT order. A cursor combined with a custom sort is
//     rejected (the shared schema already refuses it; this is defence in depth),
//     and a malformed or tampered cursor is a 400, never "silently page 1".
//
// `meta.nextCursor` is only handed out when the page was read in the default
// order — the only order a cursor can continue — so a client can never get a
// cursor that would continue a different sort.
//
// Keyset pages report their position HONESTLY. The shared paginated contract
// (`ApiPaginatedMetaSchema`) requires `total`, `page`, `totalPages` and
// `hasPrevious` on every page, so a keyset page derives them from two counts —
// the rows matching the filters (`total`) and the rows after the cursor
// (`remaining`): `total - remaining` rows precede this page, so `hasPrevious`
// is `rowsBefore > 0` and `page` is the 1-based offset page this slice starts
// on. This costs two COUNTs per keyset page (offset pages need one); the
// contract forces it — see docs/technical/api/list-queries.md.

import { buildOffsetPaginationMeta, type OffsetPaginationMeta, type PaginatedServiceResult } from "@workspace/shared";

import { CursorPaginationUnsupportedError, InvalidListCursorError } from "./persistence.errors";
import type { ListKeyset } from "./list-query/keyset-cursor";
import type { ListOrder } from "./list-query/list-order";
import type { RepositoryListResult } from "./types";

/** The pagination part of every validated list query. */
export interface ListPageRequest {
	readonly page: number;
	readonly limit: number;
	readonly cursor?: string | undefined;
}

export interface ListPageSpec<TWhere, TOrderBy, TRow> {
	/** Tenant / soft-delete / filter / search conditions — already complete. */
	readonly where: TWhere;
	readonly order: ListOrder<TOrderBy>;
	/** Keyset for the default order; omit for resources that only support offset pages. */
	readonly keyset?: ListKeyset<TRow, TWhere> | undefined;
	/** Combines the list `where` with the keyset "after cursor" condition (`{ AND: [left, right] }`). */
	readonly and: (left: TWhere, right: TWhere) => TWhere;
	readonly count: (where: TWhere) => Promise<number>;
	readonly findMany: (args: { where: TWhere; orderBy: TOrderBy[]; take: number; skip?: number }) => Promise<TRow[]>;
}

/** Shared offset + keyset list pagination. Returns raw rows; map them to domain objects with {@link mapListResult}. */
export async function fetchListPage<TWhere, TOrderBy, TRow>(request: ListPageRequest, spec: ListPageSpec<TWhere, TOrderBy, TRow>): Promise<RepositoryListResult<TRow>> {
	if (request.cursor !== undefined) {
		return fetchKeysetPage(request.cursor, request.limit, spec);
	}
	return fetchOffsetPage(request, spec);
}

async function fetchOffsetPage<TWhere, TOrderBy, TRow>(request: ListPageRequest, spec: ListPageSpec<TWhere, TOrderBy, TRow>): Promise<RepositoryListResult<TRow>> {
	const total: number = await spec.count(spec.where);
	const offsetMeta: OffsetPaginationMeta = buildOffsetPaginationMeta(total, request.page, request.limit);
	const rows: TRow[] = await spec.findMany({
		where: spec.where,
		orderBy: spec.order.orderBy,
		skip: (offsetMeta.page - 1) * request.limit,
		take: request.limit,
	});
	return {
		items: rows,
		total,
		page: offsetMeta.page,
		totalPages: offsetMeta.totalPages,
		nextCursor: offsetMeta.hasNext && spec.order.isDefault ? continuationCursor(spec.keyset, rows.at(-1)) : null,
		hasNext: offsetMeta.hasNext,
		hasPrevious: offsetMeta.hasPrevious,
	};
}

async function fetchKeysetPage<TWhere, TOrderBy, TRow>(cursor: string, limit: number, spec: ListPageSpec<TWhere, TOrderBy, TRow>): Promise<RepositoryListResult<TRow>> {
	const keyset: ListKeyset<TRow, TWhere> | undefined = spec.keyset;
	if (keyset === undefined) {
		throw new CursorPaginationUnsupportedError();
	}
	if (!spec.order.isDefault) {
		throw new InvalidListCursorError("Cursor pagination follows the default order; remove `sort` or paginate with `page`.");
	}
	// Throws InvalidListCursorError (400) for a malformed or tampered cursor.
	const afterCursor: TWhere = spec.and(spec.where, keyset.decode(cursor));
	// Sequential on purpose: the spec may run on an interactive transaction client, which serves one query at a time.
	const total: number = await spec.count(spec.where);
	const remaining: number = await spec.count(afterCursor);
	const rows: TRow[] = await spec.findMany({ where: afterCursor, orderBy: spec.order.orderBy, take: limit + 1 });
	const hasNext: boolean = rows.length > limit;
	const pageRows: TRow[] = hasNext ? rows.slice(0, limit) : rows;
	const position: KeysetPagePosition = keysetPagePosition(total, remaining, limit);
	return {
		items: pageRows,
		total,
		page: position.page,
		totalPages: position.totalPages,
		nextCursor: hasNext ? continuationCursor(keyset, pageRows.at(-1)) : null,
		hasNext,
		hasPrevious: position.hasPrevious,
	};
}

/** Where a keyset page sits in the filtered result, expressed in the contract's offset terms. */
export interface KeysetPagePosition {
	readonly page: number;
	readonly totalPages: number;
	readonly hasPrevious: boolean;
}

/**
 * Derives the honest page position of a keyset slice from `total` (rows
 * matching the filters) and `remaining` (those after the cursor). The two
 * counts are separate statements, so a concurrent insert can make `remaining`
 * exceed `total` by a row or two — `rowsBefore` never goes below zero and the
 * page never past the last one.
 */
export function keysetPagePosition(total: number, remaining: number, limit: number): KeysetPagePosition {
	// Same page-size floor and page count as offset pages.
	const firstPage: OffsetPaginationMeta = buildOffsetPaginationMeta(total, 1, limit);
	const rowsBefore: number = Math.max(0, total - remaining);
	return {
		page: Math.min(Math.floor(rowsBefore / firstPage.limit) + 1, firstPage.totalPages),
		totalPages: firstPage.totalPages,
		hasPrevious: rowsBefore > 0,
	};
}

/** Cursor continuing after `lastRow`, or `null` when the resource has no keyset or the page is empty. */
function continuationCursor<TRow, TWhere>(keyset: ListKeyset<TRow, TWhere> | undefined, lastRow: TRow | undefined): string | null {
	if (keyset === undefined || lastRow === undefined) return null;
	return keyset.encode(lastRow);
}

/** Maps a raw-row list result to domain items, keeping the pagination fields. */
export function mapListResult<TRow, TItem>(result: RepositoryListResult<TRow>, toItem: (row: TRow) => TItem): RepositoryListResult<TItem> {
	return { ...result, items: result.items.map(toItem) };
}

/** Adds the request's page size to a repository list result — the shape the response interceptor turns into `data` + `meta`. */
export function toPaginatedServiceResult<TItem>(result: RepositoryListResult<TItem>, request: Pick<ListPageRequest, "limit">): PaginatedServiceResult<TItem> {
	return {
		items: [...result.items],
		limit: request.limit,
		total: result.total,
		page: result.page,
		totalPages: result.totalPages,
		nextCursor: result.nextCursor,
		hasNext: result.hasNext,
		hasPrevious: result.hasPrevious,
	};
}
