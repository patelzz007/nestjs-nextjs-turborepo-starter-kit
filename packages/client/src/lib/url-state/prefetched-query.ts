// ============================================
// lib/url-state/prefetched-query.ts - a server-prefetched page bound to its URL state
// ============================================
// A server page prefetches the list page its URL asks for and hands it to the
// client view as TanStack Query `initialData`. The client may only use it
// while it renders the SAME URL state — after the user pages, sorts or
// filters, the prefetched page belongs to another query key. `stateKey` is
// the URL state serialized by its codec (canonical: defaults omitted, fixed
// key order), so "same state" is a string comparison
// (docs/technical/api/list-queries.md §7).
//
// Server-safe (no "use client").

/** One server-prefetched response and the URL state it was fetched for. */
export interface PrefetchedQuery<TData> {
	/** `codec.serialize(state)` of the URL state the server fetched. */
	readonly stateKey: string;
	readonly data: TData;
}

/** The fulfilled value of a server prefetch as a {@link PrefetchedQuery}, or `undefined` when the request failed (the client then fetches it). */
export function toPrefetchedQuery<TData>(stateKey: string, result: PromiseSettledResult<TData>): PrefetchedQuery<TData> | undefined {
	return result.status === "fulfilled" ? { stateKey, data: result.value } : undefined;
}

/** The prefetched data when it was fetched for `stateKey`, otherwise `undefined`. */
export function prefetchedDataFor<TData>(prefetched: PrefetchedQuery<TData> | undefined, stateKey: string): TData | undefined {
	return prefetched?.stateKey === stateKey ? prefetched.data : undefined;
}
