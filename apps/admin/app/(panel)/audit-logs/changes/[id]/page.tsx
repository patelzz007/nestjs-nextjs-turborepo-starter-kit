import { DataChangeLogIdParamSchema } from "@workspace/shared";
import { notFound } from "next/navigation";

import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, resolvePrefetchedData } from "@/lib/server/prefetch";

import DataChangeDetailView from "./data-change-detail";

export const dynamic = "force-dynamic";

/**
 * `/audit-logs/changes/[id]` — one complete row change (READ AUDIT_LOG), row images
 * included. The id is validated with the API's own param schema: a malformed
 * id is a 404, never an API call. The API records the read as a sensitive read.
 */
export default async function DataChangeDetailPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
	const parsed = DataChangeLogIdParamSchema.safeParse(await params);
	if (!parsed.success) {
		notFound();
	}
	const id: string = parsed.data.id;
	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/audit-logs/changes/[id]", resource: "data change" }, () => server.dataChanges.detail.query({ id }));

	return <DataChangeDetailView id={id} initialRecord={resolvePrefetchedData(result)} />;
}
