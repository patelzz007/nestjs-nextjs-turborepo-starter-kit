import type { EpochMs } from "../api/common";
import type { RewardResponse } from "./rewards";

export type RewardClaimBlockReason = "sold_out" | "expired" | "not_published";

type ClaimableReward = Pick<RewardResponse, "status" | "quantityRemaining" | "expiryDate">;

/** Why a published marketplace reward cannot be claimed right now, if any. */
export function getRewardClaimBlockReason(reward: ClaimableReward, nowMs: EpochMs): RewardClaimBlockReason | null {
	if (reward.status !== "PUBLISHED") {
		return "not_published";
	}
	if (reward.expiryDate < nowMs) {
		return "expired";
	}
	if (reward.quantityRemaining <= 0) {
		return "sold_out";
	}
	return null;
}

export function isRewardClaimable(reward: ClaimableReward, nowMs: EpochMs): boolean {
	return getRewardClaimBlockReason(reward, nowMs) === null;
}

export function rewardClaimBlockMessage(reason: RewardClaimBlockReason): string {
	switch (reason) {
		case "sold_out":
			return "This reward is sold out. Browse other offers.";
		case "expired":
			return "This reward has expired.";
		case "not_published":
			return "This reward is no longer available.";
	}
}
