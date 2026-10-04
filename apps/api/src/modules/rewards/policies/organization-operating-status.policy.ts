import { ForbiddenException } from "@nestjs/common";
import type { OrganizationLifecycleState } from "@prisma/client";

/** The only lifecycle state in which a merchant may pair tills and redeem rewards. */
const OPERATING_LIFECYCLE_STATE: OrganizationLifecycleState = "ACTIVE";

/** Stable error code for every POS / merchant-key call of an organization that is not operating. */
export const ORGANIZATION_NOT_ACTIVE_ERROR = "ORGANIZATION_NOT_ACTIVE";

/** The organization fields the policy decides on. */
export interface OrganizationOperatingStatus {
	readonly lifecycleState: OrganizationLifecycleState;
	readonly isDeleted: boolean;
}

/** Whether an organization may operate (pair tills, redeem, use merchant API keys). */
export function isOrganizationOperating(status: OrganizationOperatingStatus): boolean {
	return !status.isDeleted && status.lifecycleState === OPERATING_LIFECYCLE_STATE;
}

/**
 * The single rule every merchant-key path applies (POS guard, API-key
 * verification, till pairing): only an ACTIVE, non-deleted organization
 * operates. PROVISIONING, RESTRICTED, SUSPENDED, PENDING_DELETION and DELETED
 * are all refused with 403 `ORGANIZATION_NOT_ACTIVE`.
 */
export function assertOrganizationOperating(status: OrganizationOperatingStatus): void {
	if (!isOrganizationOperating(status)) {
		throw new ForbiddenException({ message: "This merchant is not active", error: ORGANIZATION_NOT_ACTIVE_ERROR });
	}
}
