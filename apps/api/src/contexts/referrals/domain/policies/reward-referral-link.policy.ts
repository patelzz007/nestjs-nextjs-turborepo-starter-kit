import { DAY_MS, epochMs, REWARD_REFERRAL_ATTRIBUTION_TTL_DAYS, REWARD_REFERRAL_OPEN_LINK_LIMIT, type EpochMs } from "@workspace/shared";

/** How long a referee's attribution stays usable after they open the link. */
export const REWARD_REFERRAL_ATTRIBUTION_TTL_MS = REWARD_REFERRAL_ATTRIBUTION_TTL_DAYS * DAY_MS;

/** Why a referrer may not mint a share link for a reward (or `ok`). */
export type ReferralLinkDecision = "ok" | "not_referable" | "limit_reached";

/** What the decision is made from, loaded in the link's transaction. */
export interface ReferralLinkFacts {
	/** Whether the reward is published, live, a consumer reward and has referrals switched on. */
	readonly rewardIsReferable: boolean;
	/** The referrer's links for this reward that no referee has used yet. */
	readonly openLinks: number;
}

/** A link is minted only for a referable reward, and only while the referrer holds fewer than the cap unused. */
export function decideReferralLink(facts: ReferralLinkFacts): ReferralLinkDecision {
	if (!facts.rewardIsReferable) {
		return "not_referable";
	}
	return facts.openLinks >= REWARD_REFERRAL_OPEN_LINK_LIMIT ? "limit_reached" : "ok";
}

/** A live, unused link as the referee presents it. */
export interface AttributableReferralLink {
	readonly rewardId: string;
	readonly referrerUserId: string;
	/** The referee the link is already attached to; null while nobody claimed through it. */
	readonly refereeUserId: string | null;
}

/** Why a referee's attribution is refused (or `ok`). */
export type ReferralAttributionDecision = "ok" | "invalid" | "own_link";

/**
 * A referee may hold a link that is PENDING and either unused or already theirs. A referrer can
 * never refer themselves; a link another referee already used is answered like an unknown one.
 */
export function decideReferralAttribution(link: AttributableReferralLink | null, refereeUserId: string): ReferralAttributionDecision {
	if (link === null || (link.refereeUserId !== null && link.refereeUserId !== refereeUserId)) {
		return "invalid";
	}
	return link.referrerUserId === refereeUserId ? "own_link" : "ok";
}

/** When an attribution recorded at `now` lapses: the claim must follow before then. */
export function attributionExpiresAt(now: EpochMs): EpochMs {
	return epochMs(now + REWARD_REFERRAL_ATTRIBUTION_TTL_MS);
}
