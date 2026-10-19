import type { EpochMs } from "@workspace/shared";

/** A successful signup referral whose referrer has not been told yet, in delivery order. */
export interface OwedSignupSuccessNotice {
	readonly signupReferralId: string;
	readonly successfulAt: EpochMs;
}

/** The two people a claimed notice is about. */
export interface ClaimedSignupSuccessNotice {
	readonly referrerUserId: string;
	readonly refereeUserId: string;
}

/**
 * The "your referral is successful" bookkeeping on `SignupReferral.successNotifiedAt`, bound to
 * the caller's transaction. Claims delivers the notice (it owns the reward inbox and reaches the
 * referee's name through identity) and claims it in the same transaction, so it is written exactly
 * once (ADR 035, "Notification").
 */
export interface SignupSuccessNoticesPort {
	/** Owed notices strictly after `after` in (`successfulAt`, id) order: a notice that keeps failing never blocks the ones behind it. */
	listOwed(take: number, after: OwedSignupSuccessNotice | null): Promise<readonly OwedSignupSuccessNotice[]>;

	/** Compare-and-set on `success_notified_at IS NULL`; null when another deliverer claimed it first (or it is not successful). */
	claim(signupReferralId: string, now: EpochMs): Promise<ClaimedSignupSuccessNotice | null>;
}
