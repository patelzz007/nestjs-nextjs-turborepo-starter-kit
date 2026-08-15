import { PrefetchBoundary } from "@workspace/client/lib/api/prefetch-boundary";

import { prefetchPage } from "@workspace/client/lib/api/server-api";

import TelescopeSchedulesView from "./schedules-list";

export const dynamic = "force-dynamic";

/** `/telescope/schedules` — prefetches the registered schedule list server-side; live "run" frames stay client-side via SSE. */
export default async function TelescopeSchedulesPage(): Promise<React.JSX.Element> {
	const { state, report } = await prefetchPage((server) => [server.telescope.schedules(undefined)]);

	return (
		<PrefetchBoundary state={state} report={report}>
			<TelescopeSchedulesView />
		</PrefetchBoundary>
	);
}
