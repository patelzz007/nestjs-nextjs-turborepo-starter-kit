import type { EpochMs } from "@workspace/shared";

/** A credited referral whose "you earned a referrer reward" email has not been requested yet. */
export interface UnnotifiedReferrerCredit {
	readonly referralId: string;
	readonly referrerUserId: string;
	/** When it was credited: with `referralId`, the sweeper's keyset position. */
	readonly creditedAt: EpochMs;
}

/** Where a sweep left off: the last credit it looked at (the next page starts strictly after it). */
export interface ReferrerCreditCursor {
	readonly creditedAt: EpochMs;
	readonly referralId: string;
}

/**
 * The referrer-credit email bookkeeping on `RewardReferral.creditNotifiedAt`, bound to the
 * caller's transaction. Claims requests the email (it owns the reward inbox and reaches the
 * referrer's address through identity) and marks the referral in the same transaction, so the
 * email is requested exactly once (decision #44).
 */
export interface ReferrerCreditNoticesPort {
	/**
	 * Credited referrals still owed their email, oldest credit first (`creditedAt`, then id), strictly
	 * after `after` when given: the sweeper pages past a credit that failed instead of retrying it first forever.
	 */
	listUnnotified(take: number, after: ReferrerCreditCursor | null): Promise<readonly UnnotifiedReferrerCredit[]>;

	/** Compare-and-set on `credit_notified_at IS NULL`; `false` when another worker already took it. */
	markNotified(referralId: string, notifiedAt: EpochMs): Promise<boolean>;
}
