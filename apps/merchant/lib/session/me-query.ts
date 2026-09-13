/** Shared react-query options for `GET /merchant/me` — avoids refetch storms and 429 retries. */
export const MERCHANT_ME_QUERY_OPTIONS = {
	staleTime: 60_000,
	retry: false,
	refetchOnWindowFocus: false,
} as const;
