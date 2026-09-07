import type { PaginationInput } from "@workspace/shared";
import { buildOffsetPaginationMeta, decodeListCursor, encodeListCursor } from "@workspace/shared";

import type { RepositoryListResult } from "./types";

export interface ListPagePorts<TQuery extends PaginationInput, TWhere, TOrderBy, TRow> {
	readonly buildListWhere: (query: TQuery) => TWhere;
	readonly buildListOrderBy: (query: TQuery) => TOrderBy;
	readonly buildListCursorOrderBy: (query: TQuery) => TOrderBy;
	readonly mergeListCursor: (where: TWhere, cursorId: string) => TWhere;
	readonly readListCursorId: (row: TRow) => string;
	readonly count: (where: TWhere) => Promise<number>;
	readonly findMany: (args: { where: TWhere; take: number; skip?: number; orderBy: TOrderBy }) => Promise<TRow[]>;
}

export interface ListPageMapper<TRow, TEntity> {
	readonly toDomain: (row: TRow) => TEntity;
}

/** Shared offset + cursor list implementation for generated repositories. */
export async function fetchListPage<TQuery extends PaginationInput, TWhere, TOrderBy, TRow, TEntity>(
	query: TQuery,
	ports: ListPagePorts<TQuery, TWhere, TOrderBy, TRow>,
	mapper: ListPageMapper<TRow, TEntity>,
): Promise<RepositoryListResult<TEntity>> {
	const where = ports.buildListWhere(query);
	const total = await ports.count(where);
	const useCursor = query.cursor !== undefined;
	const page = query.page ?? 1;
	const offsetMeta = buildOffsetPaginationMeta(total, page, query.limit);

	if (useCursor) {
		const decodedCursor = decodeListCursor(query.cursor ?? "");
		const cursorWhere = decodedCursor !== null ? ports.mergeListCursor(where, decodedCursor) : where;
		const orderBy = ports.buildListCursorOrderBy(query);
		const rows = await ports.findMany({
			where: cursorWhere,
			take: query.limit + 1,
			orderBy,
		});
		const hasNext = rows.length > query.limit;
		const pageRows = hasNext ? rows.slice(0, query.limit) : rows;
		const lastRow = pageRows[pageRows.length - 1];
		const nextCursor = hasNext && lastRow !== undefined ? encodeListCursor(ports.readListCursorId(lastRow)) : null;
		return {
			items: pageRows.map((row) => mapper.toDomain(row)),
			total,
			page: offsetMeta.page,
			totalPages: offsetMeta.totalPages,
			nextCursor,
			hasNext,
			hasPrevious: false,
		};
	}

	const skip = (offsetMeta.page - 1) * query.limit;
	const rows = await ports.findMany({
		where,
		skip,
		take: query.limit,
		orderBy: ports.buildListOrderBy(query),
	});
	const lastRow = rows[rows.length - 1];
	const nextCursor = offsetMeta.hasNext && lastRow !== undefined ? encodeListCursor(ports.readListCursorId(lastRow)) : null;
	return {
		items: rows.map((row) => mapper.toDomain(row)),
		total,
		page: offsetMeta.page,
		totalPages: offsetMeta.totalPages,
		nextCursor,
		hasNext: offsetMeta.hasNext,
		hasPrevious: offsetMeta.hasPrevious,
	};
}
