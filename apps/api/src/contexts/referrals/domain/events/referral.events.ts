import type { EpochMs } from "@workspace/shared";

import { DomainEvent } from "../../../../platform/domain/domain-event";

/**
 * A referee redeemed a referred reward and the referrer was credited (checkout transaction). Claims
 * issues the referrer's credit claim and inbox notice in that same transaction (mechanism 1), and
 * requests the "you earned a referrer reward" email after the commit (mechanism 2).
 */
export class ReferrerCredited extends DomainEvent {
	public readonly eventName = "referrals.ReferrerCredited";

	public constructor(
		occurredAt: EpochMs,
		public readonly referralId: string,
		public readonly referrerUserId: string,
		public readonly referrerRewardId: string,
		public readonly referrerRewardTitle: string,
		/** When the credit claim expires (the referrer TTL, capped by the referrer reward's expiry). */
		public readonly creditClaimExpiresAt: EpochMs,
		/** How long the referrer has to redeem the credit claim, in days (for the notice text). */
		public readonly claimTtlDays: number,
	) {
		super(occurredAt);
	}
}

/**
 * A referee's first redemption made their signup referral successful (ADR 035), stamped in the
 * checkout transaction. The referrer's notice is delivered after the commit, as a system operation:
 * the till's API key may neither read the referee's name nor write into the referrer's inbox.
 */
export class SignupReferralSucceeded extends DomainEvent {
	public readonly eventName = "referrals.SignupReferralSucceeded";

	public constructor(
		occurredAt: EpochMs,
		public readonly signupReferralId: string,
	) {
		super(occurredAt);
	}
}

export type ReferralDomainEvent = ReferrerCredited | SignupReferralSucceeded;
