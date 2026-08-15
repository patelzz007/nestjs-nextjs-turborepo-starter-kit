import { PrefetchBoundary } from "@workspace/client/lib/api/prefetch-boundary";

import { prefetchPage } from "@workspace/client/lib/api/server-api";

import TelescopeMailView from "./mail-table";

export const dynamic = "force-dynamic";

/** `/telescope/mail` — prefetches the captured mail list server-side through the admin cookies. */
export default async function TelescopeMailPage(): Promise<React.JSX.Element> {
	const { state, report } = await prefetchPage((server) => [server.telescope.mail(undefined)]);

	return (
		<PrefetchBoundary state={state} report={report}>
			<TelescopeMailView />
		</PrefetchBoundary>
	);
}
