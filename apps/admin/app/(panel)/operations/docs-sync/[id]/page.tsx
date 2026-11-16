import { DocsSyncRunIdParamSchema } from "@workspace/shared";
import { notFound } from "next/navigation";

import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, resolvePrefetchedData } from "@/lib/server/prefetch";

import DocsSyncRunDetailView from "../../../../../contexts/docs-publishing/components/docs-sync-run-detail";

export const dynamic = "force-dynamic";

/**
 * `/operations/docs-sync/[id]` — one sync run (LIST DOCS_SYNC), read-only. The id is validated with the API's own
 * param schema: a malformed id is a 404, never an API call.
 */
export default async function DocsSyncRunPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
	const parsed = DocsSyncRunIdParamSchema.safeParse(await params);
	if (!parsed.success) {
		notFound();
	}
	const { id } = parsed.data;
	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/operations/docs-sync/[id]", resource: "docs sync run" }, () => server.docsPublishing.run.query({ id }));

	return <DocsSyncRunDetailView id={id} initialRecord={resolvePrefetchedData(result)} />;
}
