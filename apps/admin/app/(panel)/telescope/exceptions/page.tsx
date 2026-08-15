import { PrefetchBoundary } from "@workspace/client/lib/api/prefetch-boundary";

import { prefetchPage } from "@workspace/client/lib/api/server-api";

import TelescopeExceptionsView from "./exceptions-table";

export const dynamic = "force-dynamic";

/** `/telescope/exceptions` — prefetches the default first page server-side (client starts with the same defaults). */
export default async function TelescopeExceptionsPage(): Promise<React.JSX.Element> {
	const query = { page: 1, pageSize: 20 } as const;
	const { state, report } = await prefetchPage((server) => [server.telescope.exceptions(query)]);

	return (
		<PrefetchBoundary state={state} report={report}>
			<TelescopeExceptionsView />
		</PrefetchBoundary>
	);
}
