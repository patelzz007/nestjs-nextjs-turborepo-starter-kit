import { PrefetchBoundary } from "@workspace/client/lib/api/prefetch-boundary";

import { prefetchPage } from "@workspace/client/lib/api/server-api";

import BackupPanel from "./backup-panel";

export const dynamic = "force-dynamic";

/** `/backup` — prefetches the backup history + options server-side; polling stays client-side. */
export default async function BackupPage(): Promise<React.JSX.Element> {
	const { state, report } = await prefetchPage((server) => [server.backup.list(undefined), server.backup.options(undefined)]);

	return (
		<PrefetchBoundary state={state} report={report}>
			<BackupPanel />
		</PrefetchBoundary>
	);
}
