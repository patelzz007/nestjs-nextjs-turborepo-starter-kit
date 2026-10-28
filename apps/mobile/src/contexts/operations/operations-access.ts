// Whether this person may watch the platform's servers: the API decides (SERVER_METRIC), the drawer
// follows. The overview query is the question — answered, the section shows; refused, it stays hidden.
// The same cached query then feeds the Servers screen (TanStack Query), so asking costs nothing extra.

import { OPS_SAMPLE_INTERVAL_MS } from "@workspace/shared";

import { useApi } from "../../lib/api-context";

export type OperationsAccess = { readonly kind: "checking" } | { readonly kind: "available" } | { readonly kind: "unavailable" };

/** The Servers screen's caching: fresh for one agent interval, refetched on that pace while shown. */
export const OVERVIEW_QUERY_OPTIONS: { readonly staleTime: number; readonly refetchInterval: number; readonly retry: false } = {
	staleTime: OPS_SAMPLE_INTERVAL_MS,
	refetchInterval: OPS_SAMPLE_INTERVAL_MS,
	retry: false,
};

/** The drawer's question only reads: someone the API refuses is not asked again every 10 seconds. */
const ACCESS_QUERY_OPTIONS: { readonly staleTime: number; readonly retry: false } = { staleTime: OPS_SAMPLE_INTERVAL_MS, retry: false };

export function useOperationsAccess(): OperationsAccess {
	const api = useApi();
	const overview = api.operations.overview.useQuery(undefined, ACCESS_QUERY_OPTIONS);
	if (overview.data !== undefined) {
		return { kind: "available" };
	}
	return overview.isError ? { kind: "unavailable" } : { kind: "checking" };
}
