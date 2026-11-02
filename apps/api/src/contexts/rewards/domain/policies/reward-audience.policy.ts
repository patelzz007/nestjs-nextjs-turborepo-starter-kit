import type { RewardAudienceType } from "@workspace/shared";

import { RewardAudienceInvalidError } from "../errors/reward.errors";
import { RewardAudience } from "../value-objects/reward-audience.value-object";

/** Who the caller asked the reward to be for. */
export interface RequestedRewardAudience {
	readonly audienceType: RewardAudienceType;
	readonly customerIds: readonly string[];
}

/**
 * Pure audience rule for a new or revised reward: nothing chosen means everyone; otherwise every chosen
 * person must be one of the tenant's customers (`knownCustomerIds`, from the tenant's customer links), and
 * at least one must be chosen (400). Referrals are checked by the aggregate, which knows both.
 */
export function decideRewardAudience(requested: RequestedRewardAudience, knownCustomerIds: readonly string[]): RewardAudience {
	if (requested.audienceType === "EVERYONE") {
		return RewardAudience.everyone();
	}
	const chosen = [...new Set(requested.customerIds)];
	const known = new Set(knownCustomerIds);
	if (chosen.length === 0 || chosen.some((customerId) => !known.has(customerId))) {
		throw new RewardAudienceInvalidError();
	}
	return RewardAudience.selected(chosen);
}
