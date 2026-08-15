import { PrefetchBoundary } from "@workspace/client/lib/api/prefetch-boundary";

import { prefetchPage } from "@workspace/client/lib/api/server-api";

import TelescopeUsersView from "./users-table";

export const dynamic = "force-dynamic";

/** `/telescope/users` — prefetches the default first page server-side (client starts with the same defaults). */
export default async function TelescopeUsersPage(): Promise<React.JSX.Element> {
	const query = { page: 1, pageSize: 20, range: "24h", sort: "count" } as const;
	const { state, report } = await prefetchPage((server) => [server.telescope.users(query)]);

	return (
		<PrefetchBoundary state={state} report={report}>
			<TelescopeUsersView />
		</PrefetchBoundary>
	);
}
