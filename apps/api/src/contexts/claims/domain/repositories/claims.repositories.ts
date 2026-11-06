import type { EpochMs } from "@workspace/shared";

import type { ClaimHold } from "../aggregates/claim-hold.aggregate";
import type { OtpChallenge } from "../aggregates/otp-challenge.aggregate";
import type { RewardClaim } from "../aggregates/reward-claim.aggregate";

/** Persistence port of {@link RewardClaim}, bound to one transaction. */
export interface RewardClaimRepository {
	add(claim: RewardClaim): Promise<void>;

	/** One of the user's own live claims; {@link ClaimNotFoundError} for anyone else's or a missing one. */
	getForUser(claimId: string, userId: string): Promise<RewardClaim>;

	/** Any live claim, for system work (expiry, checkout). */
	findById(claimId: string): Promise<RewardClaim | null>;

	/** The referrer's credit claim a credited referral earned (`isReferrerCredit`), or null. */
	findReferrerCredit(referralId: string): Promise<RewardClaim | null>;

	/** Live PENDING + REDEEMED claims the user holds of the reward (the per-customer limit). */
	countHeld(userId: string, rewardId: string): Promise<number>;

	/** Overdue PENDING claims (oldest expiry first), for the expiry job. */
	listOverdue(isReferrerCredit: boolean, now: EpochMs, take: number): Promise<readonly OverdueClaim[]>;

	/** Compare-and-set on the loaded status; a claim that moved on throws `ConcurrentModificationError`. */
	save(claim: RewardClaim): Promise<void>;

	/** Same compare-and-set, answering `false` instead of throwing (the expiry job skips it). */
	saveIfUnchanged(claim: RewardClaim): Promise<boolean>;
}

/** An overdue claim the expiry job will expire, with its reward's tenant. */
export interface OverdueClaim {
	readonly claimId: string;
	readonly tenantId: string;
}

/** An overdue hold the expiry job will end, with its reward's tenant. */
export interface OverdueClaimHold {
	readonly holdId: string;
	readonly tenantId: string;
}

/** Persistence port of {@link ClaimHold}, bound to one transaction. */
export interface ClaimHoldRepository {
	add(hold: ClaimHold): Promise<void>;

	findById(holdId: string): Promise<ClaimHold | null>;

	/** The customer's unexpired ACTIVE hold of this reward, or null. */
	findLive(userId: string, rewardId: string, now: EpochMs): Promise<ClaimHold | null>;

	/** The customer's unexpired ACTIVE holds across all rewards. */
	countLive(userId: string, now: EpochMs): Promise<number>;

	/** Holds the customer took on this reward since `since`, however they ended. */
	countTakenSince(userId: string, rewardId: string, since: EpochMs): Promise<number>;

	/** ACTIVE holds past their expiry (oldest first), for the expiry job. */
	listOverdue(now: EpochMs, take: number): Promise<readonly OverdueClaimHold[]>;

	/** Compare-and-set on ACTIVE: `false` when a claim or the expiry job settled the hold first. */
	saveIfUnchanged(hold: ClaimHold): Promise<boolean>;
}

/** Persistence port of {@link OtpChallenge}. */
export interface OtpChallengeRepository {
	add(challenge: OtpChallenge): Promise<void>;

	/** The newest unconsumed, unexpired claim challenge for this user, phone and reward. */
	findActive(userId: string, phone: string, rewardId: string, now: EpochMs): Promise<OtpChallenge | null>;

	/**
	 * Persists one attempt as a compare-and-set on the counter itself (D09):
	 * `attempts = attempts + 1 WHERE attempts < max AND consumed_at IS NULL`, consuming it on a match.
	 * Concurrent attempts compose; zero rows (the limit was reached, or a concurrent match consumed
	 * it) throws `OtpAttemptsExhaustedError`, so attempts never exceed the maximum.
	 */
	recordAttempt(challenge: OtpChallenge): Promise<void>;
}
