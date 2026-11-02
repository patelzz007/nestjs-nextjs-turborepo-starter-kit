import type { EpochMs, RewardClaimResponse } from "@workspace/shared";

/** The claimant's account fields a claim reads and writes (owned by identity; written here until identity publishes its port). */
export interface ClaimantProfile {
	readonly email: string;
	readonly phone: string | null;
	readonly phoneVerifiedAt: EpochMs | null;
	readonly pendingAttributionToken: string | null;
	readonly pendingAttributionExpiresAt: EpochMs | null;
}

/** Identity's `ConsumerClaimantPort` (plan §6.3) as claims uses it, bound to one transaction. */
export interface ClaimantPort {
	/** The claimant's profile, or null when the account is gone. */
	profile(userId: string): Promise<ClaimantProfile | null>;

	/**
	 * Locks the claimant's account row `FOR UPDATE` until commit (D08): one customer's concurrent
	 * claims run one at a time, so the per-customer limit is counted on settled rows. Null when the
	 * account is gone.
	 */
	lockForClaim(userId: string): Promise<ClaimantProfile | null>;

	/** The name an account registered with (a referrer's notice names their referee); null when there is no such account. */
	displayName(userId: string): Promise<string | null>;

	/** The phone the claim was made with is now verified; the pending referral attribution is spent. */
	recordVerifiedPhone(userId: string, phone: string, now: EpochMs): Promise<void>;
}

/** Ties a referee's claim to the referral that brought them (referrals owns the row; written here until referrals publishes its port). */
export interface ReferralAttributionPort {
	/** The PENDING referral of `rewardId` behind `attributionToken`, now naming the referee; null when there is none. */
	attach(attributionToken: string, rewardId: string, refereeUserId: string): Promise<string | null>;
}

/** One row of the earlier reward inbox (`RewardNotification`), still waiting to move into the unified inbox (ADR 070). */
export interface LegacyRewardNotice {
	readonly id: string;
	readonly userId: string;
	/** The legacy type string (`reward_approved`, `signup_referral_redeemed`, …). */
	readonly type: string;
	readonly title: string;
	readonly body: string;
	readonly metadata: Readonly<Record<string, string>>;
	readonly readAt: number | null;
	readonly createdAt: number;
}

/** The earlier reward inbox, bound to one transaction: read for the move, then soft-deleted (ADR 070). */
export interface LegacyRewardNoticeStore {
	/** Up to `limit` live rows, oldest first. */
	takeBatch(limit: number): Promise<readonly LegacyRewardNotice[]>;
	/** Soft-deletes the moved rows (`isDeleted`, `deletedAt`, `deletedBy`). */
	retire(ids: readonly string[], now: number, by: string): Promise<void>;
}

/** A claim as the API returns it, read in the command's own transaction. */
export interface ClaimViewPort {
	getResponse(claimId: string): Promise<RewardClaimResponse>;
}
