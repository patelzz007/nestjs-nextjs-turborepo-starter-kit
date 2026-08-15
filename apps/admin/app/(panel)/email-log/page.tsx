import { PrefetchBoundary } from "@workspace/client/lib/api/prefetch-boundary";

import { prefetchPage } from "@workspace/client/lib/api/server-api";

import EmailLogView from "./email-log-table";

export const dynamic = "force-dynamic";

/** `/email-log` — prefetches the sent-email log server-side; live SSE updates stay client-side. */
export default async function EmailLogPage(): Promise<React.JSX.Element> {
	const { state, report } = await prefetchPage((server) => [server.email.logList(undefined)]);

	return (
		<PrefetchBoundary state={state} report={report}>
			<EmailLogView />
		</PrefetchBoundary>
	);
}
