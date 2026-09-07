import { ApiPaginatedMetaSchema, ApiResponseMetaSchema, nowEpochMs, type ApiPaginatedMeta, type ApiResponseMeta } from "@workspace/shared";

/** Placeholder envelope meta for react-query `initialData` (SSR prefetch hydration). */
export function stubApiMeta(): ApiResponseMeta {
	return ApiResponseMetaSchema.parse({ correlationId: "", timestamp: nowEpochMs() });
}

/** Cursor-paginated meta stub for list endpoints hydrated from the server. */
export function stubPaginatedMeta(limit: number, hasNext: boolean, nextCursor: string | null = null): ApiPaginatedMeta {
	return ApiPaginatedMetaSchema.parse({
		correlationId: "",
		timestamp: nowEpochMs(),
		limit,
		nextCursor,
		hasNext,
	});
}

/** Read `hasNext` from a paginated envelope meta object. */
export function readPaginatedHasNext(meta: ApiResponseMeta | undefined, fallback: boolean = false): boolean {
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
