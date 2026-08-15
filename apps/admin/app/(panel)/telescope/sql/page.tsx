import { TelescopeSqlListQuerySchema, type TelescopeSqlListQuery } from "@workspace/shared";

import { PrefetchBoundary } from "@workspace/client/lib/api/prefetch-boundary";

import { prefetchPage } from "@workspace/client/lib/api/server-api";

import TelescopeSqlView from "./sql-table";

export const dynamic = "force-dynamic";

/**
 * `/telescope/sql` — prefetches the default first page server-side. The view
 * defaults `minDurationMs` to "100" (its presets start at ≥100ms) and derives
 * its query through the shared schema — so this page runs the SAME raw input
 * through the SAME schema. That yields the exact parsed shape the view's
 * `useQuery` key uses; otherwise the hydration key misses and the client
 * re-fetches on mount.
 */
export default async function TelescopeSqlPage(): Promise<React.JSX.Element> {
	const query: TelescopeSqlListQuery = TelescopeSqlListQuerySchema.parse({ page: 1, pageSize: 20, sort: "duration", minDurationMs: "100" });
	const { state, report } = await prefetchPage((server) => [server.telescope.sql(query)]);

	return (
		<PrefetchBoundary state={state} report={report}>
			<TelescopeSqlView />
		</PrefetchBoundary>
	);
}
