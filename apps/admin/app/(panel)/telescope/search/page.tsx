import { PrefetchBoundary } from "@workspace/client/lib/api/prefetch-boundary";

import { prefetchPage } from "@workspace/client/lib/api/server-api";

import TelescopeSearchView from "./search-results";

export const dynamic = "force-dynamic";

/**
 * `/telescope/search` — global free-text search. Prefetches results server-side
 * only when `?q=` is present and non-empty (the client disables its query
 * otherwise); the empty box renders its idle state with no API call.
 */
export default async function TelescopeSearchPage({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	const sp = await searchParams;
	const rawQ: string | undefined = typeof sp.q === "string" ? sp.q : undefined;
	const q: string = rawQ?.trim() ?? "";
	const hasQuery: boolean = q.length > 0;

	// The single input `{ q, limit }` drives both the URL and the react-query
	// key — identical to what the client view computes, so the hydration binds.
	const { state, report } = await prefetchPage((server) => [server.telescope.search({ q, limit: 10 }, { enabled: hasQuery })]);

	return (
		<PrefetchBoundary state={state} report={report}>
			<TelescopeSearchView />
		</PrefetchBoundary>
	);
}
