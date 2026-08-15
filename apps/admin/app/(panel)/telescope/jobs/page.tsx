import { PrefetchBoundary } from "@workspace/client/lib/api/prefetch-boundary";

import { prefetchPage } from "@workspace/client/lib/api/server-api";

import TelescopeJobsView from "./jobs-table";

export const dynamic = "force-dynamic";

/** `/telescope/jobs` — prefetches the default first page server-side (client starts with the same defaults). */
export default async function TelescopeJobsPage(): Promise<React.JSX.Element> {
	const query = { page: 1, pageSize: 20 } as const;
	const { state, report } = await prefetchPage((server) => [server.telescope.jobs(query)]);

	return (
		<PrefetchBoundary state={state} report={report}>
			<TelescopeJobsView />
		</PrefetchBoundary>
	);
}
