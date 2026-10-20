import type { TenantLifecycleState } from "@workspace/shared";

/** The only lifecycle state in which a merchant operates. */
const OPERATING_LIFECYCLE_STATE: TenantLifecycleState = "ACTIVE";

/** The tenant fields the rule decides on. */
export interface TenantOperatingStatus {
	readonly lifecycleState: TenantLifecycleState;
	readonly isDeleted: boolean;
}

/**
 * Whether a tenant operates: pairs tills, redeems rewards, uses merchant API keys. Only an
 * ACTIVE, live tenant does; PROVISIONING, RESTRICTED, SUSPENDED, PENDING_DELETION and DELETED
 * do not.
 */
export function isTenantOperating(status: TenantOperatingStatus): boolean {
	return !status.isDeleted && status.lifecycleState === OPERATING_LIFECYCLE_STATE;
}
