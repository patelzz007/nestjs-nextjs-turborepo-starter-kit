import { ApiPaginatedMetaSchema, type ApiPaginatedMeta } from "../schemas/api/api-response";
import { nowEpochMs } from "../schemas/api/common";

/** Offset pagination metadata derived from a total row count. */
export interface OffsetPaginationMeta {
	readonly total: number;
	readonly page: number;
	readonly limit: number;
	readonly totalPages: number;
	readonly hasNext: boolean;
	readonly hasPrevious: boolean;
}

/** Build page/total metadata for offset-based list responses. */
export function buildOffsetPaginationMeta(total: number, page: number, limit: number): OffsetPaginationMeta {
	const safeLimit = Math.max(1, limit);
	const totalPages = total === 0 ? 1 : Math.ceil(total / safeLimit);
	const safePage = Math.min(Math.max(page, 1), totalPages);
	return {
		total,
		page: safePage,
		limit: safeLimit,
		totalPages,
		hasNext: safePage < totalPages,
		hasPrevious: safePage > 1,
	};
}

/**
 * Valid paginated meta stub for react-query `initialData` / SSR hydration.
 * Always parsed through `ApiPaginatedMetaSchema` so envelope shape cannot drift.
 */
export function stubPaginatedMeta(
	limit: number,
	total: number,
	page: number,
	totalPages: number,
	hasNext: boolean,
	nextCursor: string | null = null,
	hasPrevious: boolean = page > 1,
): ApiPaginatedMeta {
	return ApiPaginatedMetaSchema.parse({
		correlationId: "",
		timestamp: nowEpochMs(),
		limit,
		total,
		page,
		totalPages,
		nextCursor,
		hasNext,
		hasPrevious,
	});
}

/**
 * First-page hydration helper when only the current slice + `hasNext` are known.
 * Prefer passing real API meta from the server when available.
 */
export function stubPaginatedMetaFromHydration(
	limit: number,
	itemCount: number,
	hasNext: boolean,
	nextCursor: string | null = null,
): ApiPaginatedMeta {
	const safeLimit = Math.max(1, limit);
	const total = hasNext ? Math.max(itemCount + 1, safeLimit) : itemCount;
	const offset = buildOffsetPaginationMeta(total, 1, safeLimit);
	return stubPaginatedMeta(safeLimit, offset.total, offset.page, offset.totalPages, hasNext, nextCursor, offset.hasPrevious);
}
