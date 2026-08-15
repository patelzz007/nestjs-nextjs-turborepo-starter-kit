import { PrefetchBoundary } from "@workspace/client/lib/api/prefetch-boundary";
import { TelescopeRangeSchema, type TelescopeRange } from "@workspace/shared";

import { prefetchPage } from "@workspace/client/lib/api/server-api";

import TelescopeOverviewView from "./overview";

export const dynamic = "force-dynamic";

/**
 * `/telescope` — the live overview dashboard. Server component: prefetches the
 * overview snapshot (range from `?range=`) and the preview cards through the
 * admin cookies, then hydrates the client cache via `HydrationBoundary` — the
 * views keep plain `useQuery()` and the initial SSR HTML already contains the
 * real stats (no skeleton flash). The SSE stream + range picker stay
 * client-side.
 */
export default async function TelescopeOverviewPage({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	const sp = await searchParams;
	const rawRange: string | undefined = typeof sp.range === "string" ? sp.range : undefined;
	const parsedRange = TelescopeRangeSchema.safeParse(rawRange);
	const range: TelescopeRange = parsedRange.success ? parsedRange.data : "15m";

	// tRPC-style: the caller (`server`) turns each procedure call into a
	// prefetch spec — the input drives both the URL and the react-query key,
	// which is exactly what the views' `useQuery(input)` calls compute.
	const { state, report } = await prefetchPage((server) => [
		server.telescope.overview({ range }),
		server.telescope.exceptions({ page: 1, pageSize: 5 }),
		server.telescope.trends({ range }),
		server.telescope.leaderboard({ range }),
		server.telescope.alerts(undefined),
		server.telescope.requests({ page: 1, pageSize: 5, sort: "newest", starred: "true" }),
		server.telescope.webhookDeliveries(undefined),
	]);

	return (
		<PrefetchBoundary state={state} report={report}>
			<TelescopeOverviewView />
		</PrefetchBoundary>
	);
}
