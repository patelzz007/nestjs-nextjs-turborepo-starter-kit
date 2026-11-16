import { DOCS_SYNC_RUNS_URL_STATE, toDocsSyncRunListQuery } from "@/contexts/docs-publishing/url-state/docs-sync-runs";
import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, resolvePrefetchedData, resolvePrefetchedQuery } from "@/lib/server/prefetch";

import DocsSyncView from "../../../../contexts/docs-publishing/components/docs-sync-view";

export const dynamic = "force-dynamic";

/** `/operations/docs-sync` — the setup, the latest runs and the run history (LIST DOCS_SYNC), fetched server-side. */
export default async function DocsSyncPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<React.JSX.Element> {
	const urlState = DOCS_SYNC_RUNS_URL_STATE.parse(await searchParams);
	const server = createAdminServerCaller();
	const [overview, runs] = await Promise.all([
		prefetch({ page: "/operations/docs-sync", resource: "docs sync overview" }, () => server.docsPublishing.overview.query({})),
		prefetch({ page: "/operations/docs-sync", resource: "docs sync runs" }, () => server.docsPublishing.runs.query(toDocsSyncRunListQuery(urlState))),
	]);

	return <DocsSyncView initialOverview={resolvePrefetchedData(overview)} initialPage={resolvePrefetchedQuery(DOCS_SYNC_RUNS_URL_STATE.serialize(urlState), runs)} />;
}
