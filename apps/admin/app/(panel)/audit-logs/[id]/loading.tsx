import { AuditLogDetailPageSkeleton } from "@/components/loading/audit-log-skeletons";

/**
 * `/audit-logs/[id]` while the record is fetched — mirrors `AuditLogDetailView`.
 */
export default function AuditLogDetailLoading(): React.JSX.Element {
	return <AuditLogDetailPageSkeleton />;
}
