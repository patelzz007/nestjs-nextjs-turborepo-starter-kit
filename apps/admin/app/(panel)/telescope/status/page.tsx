import { PrefetchBoundary } from "@workspace/client/lib/api/prefetch-boundary";

import { prefetchPage } from "@workspace/client/lib/api/server-api";

import TelescopeStatusView from "./status-dashboard";

export const dynamic = "force-dynamic";

/** `/telescope/status` — prefetches the capture config/health snapshot + webhook deliveries server-side. */
export default async function TelescopeStatusPage(): Promise<React.JSX.Element> {
	const { state, report } = await prefetchPage((server) => [server.telescope.status(undefined), server.telescope.webhookDeliveries(undefined)]);

	return (
		<PrefetchBoundary state={state} report={report}>
			<TelescopeStatusView />
		</PrefetchBoundary>
	);
}
