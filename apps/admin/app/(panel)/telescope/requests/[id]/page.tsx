import { PrefetchBoundary } from "@workspace/client/lib/api/prefetch-boundary";

import { prefetchPage } from "@workspace/client/lib/api/server-api";

import TelescopeRequestDetailView from "./request-detail";

export const dynamic = "force-dynamic";

/**
 * `/telescope/requests/[id]` — request drill-down. Server component: prefetches
 * the detail payload (the heavy SQL/dumps/N+1 analysis stays lazy on the client
 * by design) and hydrates via `HydrationBoundary` so the timeline + headers
 * render in the initial SSR HTML.
 */
export default async function TelescopeRequestDetailPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
	const { id } = await params;

	const { state, report } = await prefetchPage((server) => [server.telescope.requestDetail({ id })]);

	return (
		<PrefetchBoundary state={state} report={report}>
			<TelescopeRequestDetailView />
		</PrefetchBoundary>
	);
}
