import { ApiPaginatedMetaSchema, type ApiPaginatedMeta, type ApiResponseMeta, type EpochMs } from "@workspace/shared";

/**
 * Helpers for SSR-prefetched envelopes handed to TanStack Query as
 * `initialData`, and for reading pagination out of a response envelope's
 * `meta`. One copy for every app (web, admin, merchant).
 *
 * There is deliberately no way to fabricate an envelope here: a server page
 * passes the REAL envelope its prefetch returned (`server.x.y.query(…)`), so
 * the cache holds the server's own `meta` (correlation id, pagination,
 * timestamp) — never a placeholder.
 */

/** What `initialDataOption` reads from a prefetched envelope. */
export interface PrefetchedEnvelope {
	readonly meta: ApiResponseMeta;
}

/**
 * React Query `initialData` options for a server-prefetched envelope: the data
 * AND `initialDataUpdatedAt` = the server's answer time (`meta.timestamp`), so
 * staleness is measured from when the server answered — data reseeded after a
 * cache eviction or a Back navigation is not mistaken for fresh data.
 *
 * Absent prefetch → no keys at all (with `exactOptionalPropertyTypes`,
 * `initialData: undefined` differs from omitting it). Spread the result:
 * `useQuery(input, { enabled, ...initialDataOption(prefetched) })`.
 */
export function initialDataOption<TEnvelope extends PrefetchedEnvelope>(
	envelope: TEnvelope | undefined,
): { readonly initialData?: TEnvelope; readonly initialDataUpdatedAt?: EpochMs } {
	return envelope === undefined ? {} : { initialData: envelope, initialDataUpdatedAt: envelope.meta.timestamp };
}

/**
 * The pagination of a paginated envelope's meta, `undefined` while there is
 * no answer yet. A meta WITHOUT pagination is a programming error (the reader
 * was used on a non-paginated endpoint, or the contract drifted) and throws —
 * it is never papered over with a default.
 */
function readPagination(meta: ApiResponseMeta | undefined): ApiPaginatedMeta | undefined {
	return meta === undefined ? undefined : ApiPaginatedMetaSchema.parse(meta);
}

/** `total` of a paginated envelope meta; `fallback` only while there is no answer yet. */
export function readPaginatedTotal(meta: ApiResponseMeta | undefined, fallback = 0): number {
	return readPagination(meta)?.total ?? fallback;
}

/** `page` (1-indexed) of a paginated envelope meta; `fallback` only while there is no answer yet. */
export function readPaginatedPage(meta: ApiResponseMeta | undefined, fallback = 1): number {
	return readPagination(meta)?.page ?? fallback;
}

/** `totalPages` of a paginated envelope meta; `fallback` only while there is no answer yet. */
export function readPaginatedTotalPages(meta: ApiResponseMeta | undefined, fallback = 1): number {
	return readPagination(meta)?.totalPages ?? fallback;
}

/** `hasNext` of a paginated envelope meta; `fallback` only while there is no answer yet. */
export function readPaginatedHasNext(meta: ApiResponseMeta | undefined, fallback = false): boolean {
	return readPagination(meta)?.hasNext ?? fallback;
}

/** `hasPrevious` of a paginated envelope meta; `fallback` only while there is no answer yet. */
export function readPaginatedHasPrevious(meta: ApiResponseMeta | undefined, fallback = false): boolean {
	return readPagination(meta)?.hasPrevious ?? fallback;
}

/** `nextCursor` of a paginated envelope meta; `null` while there is no answer yet. */
export function readPaginatedNextCursor(meta: ApiResponseMeta | undefined): string | null {
	return readPagination(meta)?.nextCursor ?? null;
}
