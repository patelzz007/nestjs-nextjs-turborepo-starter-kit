import { ApiPaginatedMetaSchema, ApiResponseMetaSchema, nowEpochMs, stubPaginatedMeta, stubPaginatedMetaFromHydration, type ApiResponseMeta } from "@workspace/shared";

export { stubPaginatedMeta, stubPaginatedMetaFromHydration };

/** Placeholder envelope meta for react-query `initialData` (SSR prefetch hydration). */
export function stubApiMeta(): ApiResponseMeta {
	return ApiResponseMetaSchema.parse({ correlationId: "", timestamp: nowEpochMs() });
}

/** Read `hasNext` from a paginated envelope meta object. */
export function readPaginatedHasNext(meta: ApiResponseMeta | undefined, fallback = false): boolean {
	if (meta === undefined) {
		return fallback;
	}
	const parsed = ApiPaginatedMetaSchema.safeParse(meta);
	return parsed.success ? parsed.data.hasNext : fallback;
}

/** Read `nextCursor` from a paginated envelope meta object. */
export function readPaginatedNextCursor(meta: ApiResponseMeta | undefined): string | null {
	if (meta === undefined) {
		return null;
	}
	const parsed = ApiPaginatedMetaSchema.safeParse(meta);
	return parsed.success ? parsed.data.nextCursor : null;
}
