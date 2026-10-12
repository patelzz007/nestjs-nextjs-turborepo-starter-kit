import type { RewardResponse } from "@workspace/shared";

/** A reward type as consumers read it, in sentence case — one wording for cards, list rows and the detail page. */
export function rewardTypeLabel(rewardType: RewardResponse["rewardType"]): string {
	return rewardType === "DISCOUNT" ? "Discount" : "Free item";
}
