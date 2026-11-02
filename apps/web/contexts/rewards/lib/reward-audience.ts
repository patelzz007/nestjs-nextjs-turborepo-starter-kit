import type { RewardResponse } from "@workspace/shared";

/** The badge on a reward the merchant gave to chosen customers: the viewer is one of them (the API hides it from everyone else). */
export const JUST_FOR_YOU_LABEL = "Just for you";

/** Whether the viewer sees this reward because the merchant picked them for it. */
export function isRewardJustForViewer(reward: Pick<RewardResponse, "audienceType">): boolean {
	return reward.audienceType === "SELECTED_CUSTOMERS";
}
