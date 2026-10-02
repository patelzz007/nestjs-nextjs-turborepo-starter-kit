import {
	ApiPaginatedMetaSchema,
	ApiResponseMetaSchema,
	nowEpochMs,
	stubPaginatedMeta,
	stubPaginatedMetaFromHydration,
	type ApiPaginatedMeta,
	type ApiResponseMeta,
	type DataValue,
	type Envelope,
} from "@workspace/shared";

/**
 * Helpers for SSR-prefetched data handed to TanStack Query as `initialData`,
 * and for reading pagination out of a response envelope's `meta`. One copy for
 * every app (web, admin, merchant) — they previously each kept their own.
 */

export { stubPaginatedMeta, stubPaginatedMetaFromHydration };

/** Placeholder envelope meta for react-query `initialData` (SSR prefetch hydration). */
export function stubApiMeta(): ApiResponseMeta {
	return ApiResponseMetaSchema.parse({ correlationId: "", timestamp: nowEpochMs() });
}

/** Build a success envelope (`{ success: true, data, meta }`) for SSR-hydrated react-query `initialData`. */
export function successEnvelope<TData extends DataValue>(data: TData, meta: ApiResponseMeta): Envelope<TData> {
	return { success: true, data, meta };
}

/**
 * React Query `initialData` option that exists only when SSR-prefetched data exists.
 *
 * With `exactOptionalPropertyTypes`, `initialData: undefined` is not the same as omitting
 * the key, and TanStack Query types it as "absent". Spread the result into the options:
 * `useQuery(input, { enabled, ...initialDataOption(prefetched) })`.
 */
export function initialDataOption<TData>(data: TData | undefined): { readonly initialData?: TData } {
	return data !== undefined ? { initialData: data } : {};
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
