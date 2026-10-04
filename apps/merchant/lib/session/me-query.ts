import { MEMBERSHIPS_STALE_TIME_MS, retryTransientFailures } from "@/lib/query/query-policy";

interface MerchantMembershipsQueryOptions {
	readonly staleTime: number;
	readonly retry: (failureCount: number, error: Error) => boolean;
	readonly refetchOnWindowFocus: false;
}

/**
 * Shared react-query options for the organization memberships bootstrap
 * (`GET /orgs/memberships`), observed by the shell and the capabilities hook:
 * one freshness window for every observer (no refetch storms), and retries
 * only for transient failures — never for a 4xx such as a 429 rate limit.
 */
export const MERCHANT_ME_QUERY_OPTIONS: MerchantMembershipsQueryOptions = {
	staleTime: MEMBERSHIPS_STALE_TIME_MS,
	retry: retryTransientFailures,
	refetchOnWindowFocus: false,
};
