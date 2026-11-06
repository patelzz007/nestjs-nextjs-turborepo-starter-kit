import { ClaimCustomerBannedError, ClaimRewardUnavailableError } from "../../domain/errors/claims.errors";
import type { ClaimsScope } from "../claims-scope";

/**
 * A merchant that does not operate (suspended, banned, not live yet) offers nothing — answered like
 * a missing reward, as the marketplace hides it — and a customer the merchant banned takes nothing.
 */
export async function assertCustomerMayClaim(scope: ClaimsScope, tenantId: string, userId: string, rewardId: string): Promise<void> {
	if (!(await scope.customerStanding.tenantOperates(tenantId))) {
		throw new ClaimRewardUnavailableError(rewardId);
	}
	if ((await scope.customerStanding.bannedCustomers(tenantId, [userId])).has(userId)) {
		throw new ClaimCustomerBannedError();
	}
}
