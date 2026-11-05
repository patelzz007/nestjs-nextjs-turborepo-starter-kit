// ============================================
// platform/infrastructure/persistence/list-page.ts - the ONE offset + keyset list implementation
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
	/**
	 * Counts the rows matching `where`; when `atMost` is given it may stop there (`LIMIT atMost` in a
	 * subquery), which is what makes a capped count cheap on a huge table.
	 */
	readonly count: (where: TWhere, atMost?: number) => Promise<number>;
	/**
	 * Count at most this many rows (enhancement 2.3). A larger result reports `total = countCap` and
	 * `totalIsCapped`; its later pages are reached with `nextCursor`. Omit to count exactly.
	 */
	readonly countCap?: number | undefined;
	readonly findMany: (args: { where: TWhere; orderBy: TOrderBy[]; take: number; skip?: number }) => Promise<TRow[]>;
}

/** Shared offset + keyset list pagination. Returns raw rows; map them to domain objects with {@link mapListResult}. */
export async function fetchListPage<TWhere, TOrderBy, TRow>(request: ListPageRequest, spec: ListPageSpec<TWhere, TOrderBy, TRow>): Promise<RepositoryListResult<TRow>> {
	if (request.cursor !== undefined) {
		return fetchKeysetPage(request.cursor, request.limit, spec);
	}
	return fetchOffsetPage(request, spec);
}

/** A count, possibly stopped at the spec's cap. */
interface BoundedCount {
	readonly count: number;
	readonly capped: boolean;
}

/** Counts `where` exactly, or up to `countCap` (one more row is asked for, to know whether there are more). */
export async function boundedCount<TWhere, TOrderBy, TRow>(spec: ListPageSpec<TWhere, TOrderBy, TRow>, where: TWhere): Promise<BoundedCount> {
	if (spec.countCap === undefined) {
		return { count: await spec.count(where), capped: false };
	}
	const counted: number = await spec.count(where, spec.countCap + 1);
	return counted > spec.countCap ? { count: spec.countCap, capped: true } : { count: counted, capped: false };
}

/** `totalIsCapped`, present only when it is true (exact totals keep the old shape). */
function cappedFlag(capped: boolean): { readonly totalIsCapped?: boolean } {
	return capped ? { totalIsCapped: true } : {};
}

async function fetchOffsetPage<TWhere, TOrderBy, TRow>(request: ListPageRequest, spec: ListPageSpec<TWhere, TOrderBy, TRow>): Promise<RepositoryListResult<TRow>> {
	const counted: BoundedCount = await boundedCount(spec, spec.where);
	const total: number = counted.count;
	const offsetMeta: OffsetPaginationMeta = buildOffsetPaginationMeta(total, request.page, request.limit);
	const rows: TRow[] = await spec.findMany({
		where: spec.where,
		orderBy: spec.order.orderBy,
		skip: (offsetMeta.page - 1) * request.limit,
		take: request.limit,
	});
	// Past a capped total's last counted page there are still rows: a full last page continues by cursor.
	const hasNext: boolean = offsetMeta.hasNext || (counted.capped && rows.length === request.limit);
	return {
		items: rows,
		total,
		page: offsetMeta.page,
		totalPages: offsetMeta.totalPages,
		nextCursor: hasNext && spec.order.isDefault ? continuationCursor(spec.keyset, rows.at(-1)) : null,
		hasNext,
		hasPrevious: offsetMeta.hasPrevious,
		...cappedFlag(counted.capped),
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
	const counted: BoundedCount = await boundedCount(spec, spec.where);
	const remaining: BoundedCount = await boundedCount(spec, afterCursor);
	const rows: TRow[] = await spec.findMany({ where: afterCursor, orderBy: spec.order.orderBy, take: limit + 1 });
	const hasNext: boolean = rows.length > limit;
	const pageRows: TRow[] = hasNext ? rows.slice(0, limit) : rows;
	const position: KeysetPagePosition = keysetPagePosition(counted.count, remaining.count, limit);
	return {
		items: pageRows,
		total: counted.count,
		page: position.page,
		totalPages: position.totalPages,
		nextCursor: hasNext ? continuationCursor(keyset, pageRows.at(-1)) : null,
		hasNext,
		// With a capped total the rows before the cursor can't be counted; a cursor always follows a page, so there is one.
		hasPrevious: counted.capped ? true : position.hasPrevious,
		...cappedFlag(counted.capped),
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
		...cappedFlag(result.totalIsCapped === true),
	};
}
