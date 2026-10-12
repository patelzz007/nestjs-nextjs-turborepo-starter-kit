import { MFA_RECOVERY_LOADING_LABELS } from "@/components/loading/loading-labels";
import { MFA_RECOVERY_TABLE_PAGE, TablePageSkeleton } from "@/components/loading/table-page-skeleton";

/**
 * `/users/mfa-recovery` while the page of requests is fetched — the page header over `MfaRecoveryQueue`.
 */
export default function MfaRecoveryLoading(): React.JSX.Element {
	return <TablePageSkeleton labels={MFA_RECOVERY_LOADING_LABELS} shape={MFA_RECOVERY_TABLE_PAGE} />;
}
