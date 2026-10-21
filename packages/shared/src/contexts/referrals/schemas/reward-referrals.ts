import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";

// ── Reward referral links (a referrer shares a reward; the referee's claim credits them) ───

/** Days a referee's attribution stays usable after they open a referral link: the claim must follow within it. */
export const REWARD_REFERRAL_ATTRIBUTION_TTL_DAYS = 7;

/** Unused share links one referrer may hold for one reward at a time (each link credits one referee). */
export const REWARD_REFERRAL_OPEN_LINK_LIMIT = 20;

/** The query parameter a referral link carries its token in: `/rewards/:rewardId?ref=<token>`. */
export const REWARD_REFERRAL_QUERY_PARAM = "ref";

/** A link's attribution token: 32 random bytes, base64url without padding (43 characters). */
export const RewardReferralAttributionTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/u, "Invalid referral link");

export type RewardReferralAttributionToken = z.output<typeof RewardReferralAttributionTokenSchema>;

/** `POST /referrals/rewards/:rewardId/links`: a new share link of the caller for a reward. */
export const RewardReferralLinkResponseSchema = z.object({
	referralId: z.uuid(),
	rewardId: z.uuid(),
	attributionToken: RewardReferralAttributionTokenSchema,
});

export type RewardReferralLinkResponse = z.output<typeof RewardReferralLinkResponseSchema>;

/** `POST /referrals/attribution` body: the token of the link the caller opened. */
export const RewardReferralAttributionSchema = z.object({ attributionToken: RewardReferralAttributionTokenSchema }).strict();

export type RewardReferralAttributionInput = z.output<typeof RewardReferralAttributionSchema>;

/** The attribution now pending on the caller's account: the reward it is for and when it lapses. */
export const RewardReferralAttributionResponseSchema = z.object({
	rewardId: z.uuid(),
	expiresAt: EpochMsSchema,
});

export type RewardReferralAttributionResponse = z.output<typeof RewardReferralAttributionResponseSchema>;
