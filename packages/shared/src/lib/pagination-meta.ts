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
