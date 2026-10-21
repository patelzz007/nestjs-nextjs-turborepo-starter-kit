import type { KybStatus, TenantLifecycleState } from "@workspace/shared";
import type { StatusTone } from "@workspace/ui/components/status-badge";

/** How a tenant or verification status reads as a badge: its label and what it means. */
export interface TenantStatusDisplay {
	readonly label: string;
	readonly tone: StatusTone;
}

/**
 * An active tenant is good news; one being set up is in progress; a
 * restriction is waiting on someone; a suspension, a ban or a deletion blocks it.
 */
export const TENANT_LIFECYCLE_DISPLAY: Readonly<Record<TenantLifecycleState, TenantStatusDisplay>> = {
	PROVISIONING: { label: "Provisioning", tone: "info" },
	ACTIVE: { label: "Active", tone: "success" },
	RESTRICTED: { label: "Restricted", tone: "warning" },
	SUSPENDED: { label: "Suspended", tone: "danger" },
	BANNED: { label: "Banned", tone: "danger" },
	PENDING_DELETION: { label: "Pending deletion", tone: "danger" },
	DELETED: { label: "Deleted", tone: "danger" },
};

/**
 * Business verification: waiting on a reviewer is a warning, a request for
 * more documents or a rejection blocks the merchant, an approval is success.
 */
export const KYB_STATUS_DISPLAY: Readonly<Record<KybStatus, TenantStatusDisplay>> = {
	PENDING: { label: "Pending review", tone: "warning" },
	ACTION_REQUIRED: { label: "Action required", tone: "danger" },
	APPROVED: { label: "Approved", tone: "success" },
	REJECTED: { label: "Rejected", tone: "danger" },
};
