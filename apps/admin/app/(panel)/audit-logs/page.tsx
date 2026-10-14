import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, resolvePrefetchedQuery } from "@/lib/server/prefetch";
import { AUDIT_LOG_URL_STATE, toAuditLogListQuery } from "@/lib/url-state/audit-logs";

import AuditLogView from "./audit-log-table";

export const dynamic = "force-dynamic";

/**
 * `/audit-logs` — parses the table's URL state and fetches that page of the
 * audit trail timeline server-side: HTTP requests and background database
 * writes (`GET /admin/audit-trail`; the API records the read as a sensitive read).
 */
export default async function AuditLogsPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<React.JSX.Element> {
	const urlState = AUDIT_LOG_URL_STATE.parse(await searchParams);
	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/audit-logs", resource: "audit log" }, () => server.auditTrail.list.query(toAuditLogListQuery(urlState)));

	return <AuditLogView initialPage={resolvePrefetchedQuery(AUDIT_LOG_URL_STATE.serialize(urlState), result)} />;
}
