import { TENANT_OPERATING_LIFECYCLE_STATE, type TenantLifecycleState } from "@workspace/shared";

/** The tenant fields the rule decides on. */
export interface TenantOperatingStatus {
	readonly lifecycleState: TenantLifecycleState;
	readonly isDeleted: boolean;
}

/**
 * Whether a tenant operates: pairs tills, redeems rewards, uses merchant API keys. Only an
 * ACTIVE, live tenant does; PROVISIONING, RESTRICTED, SUSPENDED, BANNED, PENDING_DELETION and
 * DELETED do not.
 */
export function isTenantOperating(status: TenantOperatingStatus): boolean {
	return !status.isDeleted && status.lifecycleState === TENANT_OPERATING_LIFECYCLE_STATE;
}
