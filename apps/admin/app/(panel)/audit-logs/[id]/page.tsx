import { HttpAuditLogIdParamSchema } from "@workspace/shared";
import { notFound } from "next/navigation";

import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, resolvePrefetchedData } from "@/lib/server/prefetch";

import AuditLogDetailView from "./audit-log-detail";

export const dynamic = "force-dynamic";

/**
 * `/audit-logs/[id]` — one complete audit record (READ AUDIT_LOG), payloads
 * included. The id is validated with the API's own param schema: a malformed
 * id is a 404, never an API call. The API records the read as a sensitive read.
 */
export default async function AuditLogDetailPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
	const parsed = HttpAuditLogIdParamSchema.safeParse(await params);
	if (!parsed.success) {
		notFound();
	}
	const id: string = parsed.data.id;
	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/audit-logs/[id]", resource: "audit record" }, () => server.auditLogs.detail.query({ id }));

	return <AuditLogDetailView id={id} initialRecord={resolvePrefetchedData(result)} />;
}
