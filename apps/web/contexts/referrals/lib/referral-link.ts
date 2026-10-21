import { ApiError } from "@workspace/client/lib/api/api-request";
import {
	REWARD_REFERRAL_ATTRIBUTION_TTL_DAYS,
	REWARD_REFERRAL_QUERY_PARAM,
	RewardReferralAttributionTokenSchema,
	type RewardReferralAttributionToken,
} from "@workspace/shared";

import { publicRewardDetailPath } from "@/lib/routes";

/** The path a referral link opens: the public reward page with the link's token (`/rewards/:id?ref=…`). */
export function referralLinkPath(rewardId: string, attributionToken: string): string {
	return `${publicRewardDetailPath(rewardId)}?${new URLSearchParams({ [REWARD_REFERRAL_QUERY_PARAM]: attributionToken }).toString()}`;
}

/** The referral token a page was opened with, or `null` when there is none or it is not one the API could have issued. */
export function readReferralToken(searchParams: Pick<URLSearchParams, "get">): RewardReferralAttributionToken | null {
	const parsed = RewardReferralAttributionTokenSchema.safeParse(searchParams.get(REWARD_REFERRAL_QUERY_PARAM));
	return parsed.success ? parsed.data : null;
}

/** `pathname` with the referral token kept, so signing in returns to the same link. */
export function withReferralToken(pathname: string, attributionToken: RewardReferralAttributionToken | null): string {
	return attributionToken === null ? pathname : `${pathname}?${new URLSearchParams({ [REWARD_REFERRAL_QUERY_PARAM]: attributionToken }).toString()}`;
}

/** What the visitor is told once the link they opened was handled. */
export function referralAttributionMessage(outcome: Error | null): string {
	if (outcome === null) {
		return `Your friend's link is saved. Claim this reward within ${String(REWARD_REFERRAL_ATTRIBUTION_TTL_DAYS)} days and they get credit when you redeem it.`;
	}
	if (outcome instanceof ApiError && outcome.error === "REFERRAL_OWN_LINK") {
		return "This is your own referral link. Share it with a friend instead.";
	}
	if (outcome instanceof ApiError && outcome.error === "REFERRAL_LINK_INVALID") {
		return "This referral link is no longer valid. You can still claim the reward.";
	}
	return outcome.message;
}

/** What the referrer is told when a link could not be minted. */
export function referralShareErrorMessage(error: Error): string {
	if (error instanceof ApiError && error.error === "REFERRAL_REWARD_NOT_REFERABLE") {
		return "This reward cannot be shared right now.";
	}
	return error.message;
}
