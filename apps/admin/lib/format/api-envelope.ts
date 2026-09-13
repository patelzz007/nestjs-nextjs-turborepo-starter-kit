import { ApiPaginatedMetaSchema, ApiResponseMetaSchema, nowEpochMs, stubPaginatedMeta, type ApiPaginatedMeta, type ApiResponseMeta } from "@workspace/shared";

export { stubPaginatedMeta };

/** Placeholder envelope meta for react-query `initialData` (SSR prefetch hydration). */
export function stubApiMeta(): ApiResponseMeta {
	return ApiResponseMetaSchema.parse({ correlationId: "", timestamp: nowEpochMs() });
}

function parsePaginatedMeta(meta: ApiResponseMeta | undefined): ApiPaginatedMeta | null {
	if (meta === undefined) {
		return null;
	}
	const parsed = ApiPaginatedMetaSchema.safeParse(meta);
	return parsed.success ? parsed.data : null;
}

/** Read `total` from a paginated envelope meta object. */
export function readPaginatedTotal(meta: ApiResponseMeta | undefined, fallback = 0): number {
	return parsePaginatedMeta(meta)?.total ?? fallback;
}

/** Read `page` (1-indexed) from a paginated envelope meta object. */
export function readPaginatedPage(meta: ApiResponseMeta | undefined, fallback = 1): number {
	return parsePaginatedMeta(meta)?.page ?? fallback;
}

/** Read `totalPages` from a paginated envelope meta object. */
export function readPaginatedTotalPages(meta: ApiResponseMeta | undefined, fallback = 1): number {
	return parsePaginatedMeta(meta)?.totalPages ?? fallback;
}

/** Read `hasNext` from a paginated envelope meta object. */
export function readPaginatedHasNext(meta: ApiResponseMeta | undefined, fallback = false): boolean {
	return parsePaginatedMeta(meta)?.hasNext ?? fallback;
}

/** Read `hasPrevious` from a paginated envelope meta object. */
export function readPaginatedHasPrevious(meta: ApiResponseMeta | undefined, fallback = false): boolean {
	return parsePaginatedMeta(meta)?.hasPrevious ?? fallback;
}

/** Read `nextCursor` from a paginated envelope meta object. */
export function readPaginatedNextCursor(meta: ApiResponseMeta | undefined): string | null {
	return parsePaginatedMeta(meta)?.nextCursor ?? null;
}
