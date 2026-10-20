import type { EpochMs } from "@workspace/shared";

/** The consumer facts a reward claim needs from the account (`User` row). */
export interface ConsumerClaimant {
	readonly email: string;
	readonly phone: string | null;
	readonly phoneVerifiedAt: EpochMs | null;
	/** The referral attribution the consumer arrived with, spent by their first claim. */
	readonly pendingAttributionToken: string | null;
	readonly pendingAttributionExpiresAt: EpochMs | null;
}

/**
 * Exposed to claims (plan §6.3): the claimant behind a reward claim, and the phone an OTP-backed claim
 * proved, recorded in the claim's transaction. Bound with `createIdentityTransactionalPorts(db)`.
 */
export interface ConsumerClaimantPort {
	/**
	 * The live account's claimant facts; `null` when it is gone. With `lock`, the account row is locked
	 * (`FOR UPDATE`) until commit, so one consumer's concurrent claims run one at a time.
	 */
	findClaimant(userId: string, options: { readonly lock: boolean }): Promise<ConsumerClaimant | null>;
	/**
	 * The name the account registered with, for a notice about that person (a deactivated or
	 * soft-deleted account still names who it was); `null` when no account row exists.
	 */
	displayName(userId: string): Promise<string | null>;
	/** Stores `phone` as verified at `verifiedAt` and clears the pending attribution token. */
	markPhoneVerified(userId: string, phone: string, verifiedAt: EpochMs): Promise<void>;
}
