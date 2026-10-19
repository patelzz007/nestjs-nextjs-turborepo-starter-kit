import type { OrganizationLifecycleState } from "@workspace/shared";

/** The only lifecycle state in which a merchant operates. */
const OPERATING_LIFECYCLE_STATE: OrganizationLifecycleState = "ACTIVE";

/** The organization fields the rule decides on. */
export interface OrganizationOperatingStatus {
	readonly lifecycleState: OrganizationLifecycleState;
	readonly isDeleted: boolean;
}

/**
 * Whether an organization operates: pairs tills, redeems rewards, uses merchant API keys. Only an
 * ACTIVE, live organization does; PROVISIONING, RESTRICTED, SUSPENDED, PENDING_DELETION and DELETED
 * do not.
 */
export function isOrganizationOperating(status: OrganizationOperatingStatus): boolean {
	return !status.isDeleted && status.lifecycleState === OPERATING_LIFECYCLE_STATE;
}
