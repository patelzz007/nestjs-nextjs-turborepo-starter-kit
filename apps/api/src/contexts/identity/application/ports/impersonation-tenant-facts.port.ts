import type { EpochMs } from "@workspace/shared";

import type { ApprovedSupportGrant } from "../../domain/policies/impersonation-start.policy";

/** The tenant facts `assertImpersonationGrants` needs, loaded outside the impersonation transaction. */
export interface ImpersonationTenantFacts {
	/** Active memberships of the target. A customer returns none. */
	membershipTenantIds(userId: string): Promise<readonly string[]>;
	/** The administrator's approved, unexpired support grants, one entry per grant. */
	approvedGrants(supportUserId: string, now: EpochMs): Promise<readonly ApprovedSupportGrant[]>;
}
