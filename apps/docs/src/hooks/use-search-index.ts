import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { SearchIndexSchema, type SearchEntry } from "@/lib/search";

/** Where the build writes the index (src/routes/search-index[.]json.ts). */
export const SEARCH_INDEX_URL = "/search-index.json";
export const SEARCH_INDEX_QUERY_KEY: readonly ["docs", "search-index"] = ["docs", "search-index"];

/** Fetches and validates the index; a bad response fails the query rather than showing wrong results. */
export async function fetchSearchIndex(fetcher: typeof fetch = fetch): Promise<readonly SearchEntry[]> {
	const response = await fetcher(SEARCH_INDEX_URL);
	if (!response.ok) {
		throw new Error(`The search index could not be loaded (HTTP ${String(response.status)}).`);
	}
	return SearchIndexSchema.parse(await response.json());
}

/**
 * The search index, loaded on first use and kept for the session (it only changes with a new build). TanStack
 * Query owns it, so the dialog and the search page share one download.
 */
export function useSearchIndex(enabled: boolean): UseQueryResult<readonly SearchEntry[]> {
	return useQuery({ queryKey: SEARCH_INDEX_QUERY_KEY, queryFn: () => fetchSearchIndex(), enabled, staleTime: Number.POSITIVE_INFINITY, gcTime: Number.POSITIVE_INFINITY });
}
