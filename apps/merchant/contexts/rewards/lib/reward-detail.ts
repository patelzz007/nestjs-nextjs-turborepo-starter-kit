// How the reward page words a saved reward's facts: what its status means for
// the merchant, when it runs, how often a customer may claim it and the spend
// it needs. Pure functions — the page renders their answers.

import { REWARD_VALUE_CURRENCY } from "@workspace/client/lib/contexts/rewards/reward-offer";
import { assertNever, PLATFORM_DISPLAY_REGION, type RewardResponse, type RewardStatus } from "@workspace/shared";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";

/** What a status means for the merchant looking at the reward, in one sentence. */
export function describeRewardStatusNote(status: RewardStatus): string {
	switch (status) {
		case "DRAFT":
			return "Only your team can see this draft. Submit it for review when it's ready.";
		case "PENDING_REVIEW":
			return "Waiting for review. You can still make changes until it goes live.";
		case "PUBLISHED":
			return "Live. Customers can claim it now.";
		case "EXPIRED":
			return "This reward has ended. Customers can no longer claim it.";
		case "DISABLED":
			return "This reward was switched off. Customers can no longer claim it.";
		default:
			return assertNever(status, "reward status");
	}
}

/** "1 Oct 2026 – 31 Oct 2026", or "Until 31 Oct 2026" for a reward that starts as soon as it goes live. */
export function formatRewardRunDates(reward: Pick<RewardResponse, "startDate" | "expiryDate">): string {
	const end = formatEpochMs(reward.expiryDate, "date", PLATFORM_DISPLAY_REGION);
	if (reward.startDate === null) {
		return `Until ${end}`;
	}
	return `${formatEpochMs(reward.startDate, "date", PLATFORM_DISPLAY_REGION)} – ${end}`;
}

/** A limit of one claim per customer reads "Once". */
const SINGLE_CLAIM = 1;

/** A per-customer claim limit in words: "Once", "Up to 3 times". */
export function formatClaimLimitCount(limit: number): string {
	return limit === SINGLE_CLAIM ? "Once" : `Up to ${String(limit)} times`;
}

/** How often one customer may claim the reward, or "No limit" when no rule caps it. */
export function formatRewardClaimLimit(rules: RewardResponse["rules"]): string {
	const limit = rules?.maxUsePerUser;
	return limit === undefined ? "No limit" : formatClaimLimitCount(limit);
}

/** The spend a customer needs to use the reward ("RM 30.00"), or "None". */
export function formatRewardMinimumSpend(rules: RewardResponse["rules"]): string {
	const minimum = rules?.minSpendMyr;
	if (minimum === undefined) {
		return "None";
	}
	return new Intl.NumberFormat(PLATFORM_DISPLAY_REGION.locale, { style: "currency", currency: REWARD_VALUE_CURRENCY }).format(minimum);
}
