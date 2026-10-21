import { DomainError } from "../../../../platform/domain/errors/domain-error";
import type { DomainErrorCode } from "../../../../platform/domain/errors/error-codes";

/** The reward cannot be shared: not published or live, not a consumer reward, or its referrals are off (404). */
export class RewardNotReferableError extends DomainError {
	public readonly code: DomainErrorCode = "REFERRAL_REWARD_NOT_REFERABLE";

	public constructor() {
		super("This reward cannot be shared right now.");
	}
}

/** The referrer already holds the maximum number of unused links for this reward (409). */
export class ReferralLinkLimitReachedError extends DomainError {
	public readonly code: DomainErrorCode = "REFERRAL_LINK_LIMIT_REACHED";

	public constructor(limit: number) {
		super(`You already have ${String(limit)} unused links for this reward. Share one of those first.`);
	}
}

/** The link is unknown, no longer pending, or another person already used it (404). */
export class ReferralLinkInvalidError extends DomainError {
	public readonly code: DomainErrorCode = "REFERRAL_LINK_INVALID";

	public constructor() {
		super("This referral link is no longer valid.");
	}
}

/** The caller opened their own referral link (409): nobody refers themselves. */
export class ReferralOwnLinkError extends DomainError {
	public readonly code: DomainErrorCode = "REFERRAL_OWN_LINK";

	public constructor() {
		super("You cannot use your own referral link.");
	}
}
