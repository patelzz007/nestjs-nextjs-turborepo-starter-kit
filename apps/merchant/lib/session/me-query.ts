interface MerchantMeQueryOptions {
	readonly staleTime: number;
	readonly retry: false;
	readonly refetchOnWindowFocus: false;
}

/** Shared react-query options for organization memberships bootstrap — avoids refetch storms and 429 retries. */
export const MERCHANT_ME_QUERY_OPTIONS: MerchantMeQueryOptions = {
	staleTime: 60_000,
	retry: false,
	refetchOnWindowFocus: false,
};
