import type { PaginationInput, PaginatedServiceResult } from "@workspace/shared";
import { buildOffsetPaginationMeta, decodeListCursor, encodeListCursor } from "@workspace/shared";

import type { RepositoryListResult } from "./types";

export interface CursorListResult<TItem> {
	readonly items: readonly TItem[];
	readonly nextCursor: string | null;
	readonly hasNext: boolean;
}

/** Stable ascending-id order used by all string-id cursor lists. */
type StringIdCursorOrder = { readonly id: "asc" };

const STRING_ID_CURSOR_ORDER: StringIdCursorOrder = { id: "asc" };

export interface FetchStringIdCursorPageOptions<TWhere, TRow> {
	readonly limit: number;
	readonly cursor?: string;
	readonly where: TWhere;
	readonly mergeCursor: (where: TWhere, cursorId: string) => TWhere;
	readonly readId: (row: TRow) => string;
	readonly findMany: (args: { where: TWhere; take: number; skip?: number; orderBy: StringIdCursorOrder }) => Promise<TRow[]>;
}

/** Shared cursor pagination for repositories that paginate by ascending string `id`. */
export async function fetchStringIdCursorPage<TWhere, TRow>(options: FetchStringIdCursorPageOptions<TWhere, TRow>): Promise<CursorListResult<TRow>> {
	const decodedCursor = options.cursor !== undefined ? decodeListCursor(options.cursor) : null;
	const where = decodedCursor !== null ? options.mergeCursor(options.where, decodedCursor) : options.where;
	const rows = await options.findMany({
		where,
		take: options.limit + 1,
		orderBy: STRING_ID_CURSOR_ORDER,
	});
	const hasNext = rows.length > options.limit;
	const pageRows = hasNext ? rows.slice(0, options.limit) : rows;
	const lastRow = pageRows[pageRows.length - 1];
	const nextCursor = hasNext && lastRow !== undefined ? encodeListCursor(options.readId(lastRow)) : null;
	return { items: pageRows, nextCursor, hasNext };
}

export interface FetchStringIdListPageOptions<TWhere, TRow> {
	readonly where: TWhere;
	readonly mergeCursor: (where: TWhere, cursorId: string) => TWhere;
	readonly readId: (row: TRow) => string;
	readonly findMany: (args: { where: TWhere; take: number; skip?: number; orderBy: StringIdCursorOrder }) => Promise<TRow[]>;
	readonly count: (where: TWhere) => Promise<number>;
}

/** Offset + cursor list pagination for repositories that paginate by ascending string `id`. */
export async function fetchStringIdListPage<TWhere, TRow>(query: PaginationInput, options: FetchStringIdListPageOptions<TWhere, TRow>): Promise<RepositoryListResult<TRow>> {
	const total = await options.count(options.where);
	const useCursor = query.cursor !== undefined;
	const page = query.page ?? 1;
	const offsetMeta = buildOffsetPaginationMeta(total, page, query.limit);

	if (useCursor) {
		const cursorResult = await fetchStringIdCursorPage({
			limit: query.limit,
			cursor: query.cursor,
			where: options.where,
			mergeCursor: options.mergeCursor,
			readId: options.readId,
			findMany: options.findMany,
		});
		return {
			items: cursorResult.items,
			total,
			page: offsetMeta.page,
			totalPages: offsetMeta.totalPages,
			nextCursor: cursorResult.nextCursor,
			hasNext: cursorResult.hasNext,
			hasPrevious: false,
		};
	}

	const skip = (offsetMeta.page - 1) * query.limit;
	const rows = await options.findMany({
		where: options.where,
		skip,
		take: query.limit,
		orderBy: STRING_ID_CURSOR_ORDER,
	});
	const lastRow = rows[rows.length - 1];
	const nextCursor = offsetMeta.hasNext && lastRow !== undefined ? encodeListCursor(options.readId(lastRow)) : null;
	return {
		items: rows,
		total,
		page: offsetMeta.page,
		totalPages: offsetMeta.totalPages,
		nextCursor,
		hasNext: offsetMeta.hasNext,
		hasPrevious: offsetMeta.hasPrevious,
	};
}

export function toPaginatedServiceResult<TItem>(result: RepositoryListResult<TItem>, limit: number): PaginatedServiceResult<TItem> {
	return {
		items: [...result.items],
		limit,
		total: result.total,
		page: result.page,
		totalPages: result.totalPages,
		nextCursor: result.nextCursor,
		hasNext: result.hasNext,
		hasPrevious: result.hasPrevious,
	};
}

export function paginateCursorListResult<TItem>(result: RepositoryListResult<TItem>, query: PaginationInput): PaginatedServiceResult<TItem> {
	return toPaginatedServiceResult(result, query.limit);
}
