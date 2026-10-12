import { AUDIT_LOG_LOADING_LABELS } from "@/components/loading/loading-labels";
import { AUDIT_LOG_TABLE_PAGE, TablePageSkeleton } from "@/components/loading/table-page-skeleton";

/**
 * `/audit-logs` while the page of records is fetched — mirrors `AuditLogView`.
 */
export default function AuditLogsLoading(): React.JSX.Element {
	return <TablePageSkeleton labels={AUDIT_LOG_LOADING_LABELS} shape={AUDIT_LOG_TABLE_PAGE} />;
}
