import type { EpochMs } from "@workspace/shared";

import type { AttributableReferralLink } from "../../domain/policies/reward-referral-link.policy";

/** Whether a reward can be shared: provided by rewards (it owns `Reward`), bound to the link's transaction. */
export interface ReferableRewardLookupPort {
	isReferable(rewardId: string, now: EpochMs): Promise<boolean>;
}

/** The referee's pending attribution: provided by identity (it owns `User`), bound to the attribution's transaction. */
export interface RefereeAttributionPort {
	/** Stores `attributionToken` as the user's pending attribution until `expiresAt`; false when the user is gone. */
	setPending(userId: string, attributionToken: string, expiresAt: EpochMs, now: EpochMs): Promise<boolean>;
}

/** A new share link. */
export interface NewReferralLink {
	readonly referralId: string;
	readonly referrerUserId: string;
	readonly rewardId: string;
	readonly attributionToken: string;
	readonly now: EpochMs;
}

/** What the link commands read and write in one transaction. */
export interface RewardReferralLinkScope {
	readonly rewards: ReferableRewardLookupPort;
	readonly referees: RefereeAttributionPort;
	/** Serializes one referrer's link minting, so the open-link cap holds under concurrent requests. */
	lockReferrer(referrerUserId: string): Promise<boolean>;
	countOpenLinks(referrerUserId: string, rewardId: string): Promise<number>;
	insertLink(link: NewReferralLink): Promise<void>;
	findLink(attributionToken: string): Promise<AttributableReferralLink | null>;
}

/** Runs one link command in its named system-operation transaction (RewardReferral is bypass-write). */
export interface RewardReferralLinkTransactions {
	createLink<T>(actorUserId: string, work: (scope: RewardReferralLinkScope) => Promise<T>): Promise<T>;
	recordAttribution<T>(actorUserId: string, work: (scope: RewardReferralLinkScope) => Promise<T>): Promise<T>;
}

/** A link's attribution token and the referral row id it is stored under. */
export interface ReferralLinkIdentity {
	readonly referralId: string;
	readonly attributionToken: string;
}

/** Mints link identities (row id + 32 random bytes); a port so handler tests are deterministic. */
export interface ReferralLinkIdentityGenerator {
	next(): ReferralLinkIdentity;
}
