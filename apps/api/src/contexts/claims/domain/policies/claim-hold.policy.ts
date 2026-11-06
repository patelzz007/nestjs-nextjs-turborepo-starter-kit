import { ClaimHoldLimitReachedError } from "../errors/claims.errors";
import { MAX_LIVE_CLAIM_HOLDS, MAX_REWARD_HOLDS_PER_WINDOW } from "../value-objects/claim-rules.value-object";

/** Stops one customer tying up stock by requesting codes: a cap on units held at once, and on repeat holds of one reward. */
export function assertMayTakeHold(liveHolds: number, recentHoldsOfReward: number): void {
	if (liveHolds >= MAX_LIVE_CLAIM_HOLDS || recentHoldsOfReward >= MAX_REWARD_HOLDS_PER_WINDOW) {
		throw new ClaimHoldLimitReachedError();
	}
}
