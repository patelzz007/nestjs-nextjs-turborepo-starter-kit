import { PrefetchBoundary } from "@workspace/client/lib/api/prefetch-boundary";

import { prefetchPage } from "@workspace/client/lib/api/server-api";

import TelescopeLogsView from "./logs-table";

export const dynamic = "force-dynamic";

/** `/telescope/logs` — prefetches the default first page server-side (client starts with the same defaults). */
export default async function TelescopeLogsPage(): Promise<React.JSX.Element> {
	const query = { page: 1, pageSize: 20 } as const;
	const { state, report } = await prefetchPage((server) => [server.telescope.logs(query)]);

	return (
		<PrefetchBoundary state={state} report={report}>
			<TelescopeLogsView />
		</PrefetchBoundary>
	);
}
