import { ApiPaginatedMetaSchema, ApiResponseMetaSchema, nowEpochMs, type ApiPaginatedMeta, type ApiResponseMeta } from "@workspace/shared";

/** Placeholder envelope meta for react-query `initialData` (SSR hydration). */
export function stubApiMeta(): ApiResponseMeta {
	return ApiResponseMetaSchema.parse({ correlationId: "", timestamp: nowEpochMs() });
}

/** Paginated meta stub for list endpoints hydrated from the server. */
export function stubPaginatedMeta(total: number, page: number, limit: number): ApiPaginatedMeta {
	const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
	return ApiPaginatedMetaSchema.parse({
		correlationId: "",
		timestamp: nowEpochMs(),
		total,
		page,
		limit,
		totalPages,
		hasNext: page < totalPages,
		hasPrevious: page > 1,
	});
}

/** Read `total` from a paginated envelope meta object. */
export function readPaginatedTotal(meta: ApiResponseMeta | undefined, fallback: number): number {
	if (meta === undefined) {
		return fallback;
	}
	const parsed = ApiPaginatedMetaSchema.safeParse(meta);
	return parsed.success && parsed.data.total !== null ? parsed.data.total : fallback;
}
