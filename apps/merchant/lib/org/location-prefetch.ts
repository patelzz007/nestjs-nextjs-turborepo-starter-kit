/**
 * Server-prefetched data bound to the store filter it was fetched for, so a
 * page view can never seed a query with data for a different store.
 */
export interface LocationScopedPrefetch<TData> {
	/** The `locationId` query input the server used (`undefined` = all stores) — always stated, never implied. */
	readonly locationId: string | undefined;
	readonly data: TData;
}

/**
 * The prefetched data when it was fetched for exactly the filter the client is
 * about to query (`locationId` from `useActiveLocationFilter`), else `undefined`
 * — the query then fetches on its own instead of caching another store's data
 * under this filter's key.
 */
export function prefetchForLocation<TData>(prefetch: LocationScopedPrefetch<TData> | undefined, locationId: string | undefined): TData | undefined {
	if (prefetch === undefined || prefetch.locationId !== locationId) {
		return undefined;
	}
	return prefetch.data;
}
