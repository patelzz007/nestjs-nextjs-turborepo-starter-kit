import { DomainErrorCodeSchema } from "../../../../platform/domain/errors/error-codes";

import { DomainError } from "../../../../platform/domain/errors/domain-error";

/** Every code the claims domain throws; codes and messages clients already saw are kept byte for byte. */
export const ClaimsDomainErrorCodeSchema = DomainErrorCodeSchema.extract([
	"CLAIM_NOT_FOUND",
	"CLAIM_NOT_ACTIVE",
	"CLAIM_EXPIRED",
	"CLAIM_LIMIT_REACHED",
	"LEGAL_ACCEPTANCE_REQUIRED",
	"OTP_REQUIRED",
	"OTP_INVALID",
	"OTP_RATE_LIMITED",
	"CLAIM_CUSTOMER_BANNED",
	"REWARD_NOT_FOUND",
	"USER_NOT_FOUND",
	"CORRUPT_AGGREGATE_STATE",
]);

export type ClaimsDomainErrorCode = (typeof ClaimsDomainErrorCodeSchema)["options"][number];

/** Missing, deleted or someone else's claim — answered alike, so a claim id is no oracle. */
export class ClaimNotFoundError extends DomainError {
	public readonly code = "CLAIM_NOT_FOUND";

	public constructor(public readonly claimId: string) {
		super("Claim not found");
	}
}

export class ClaimNotActiveError extends DomainError {
	public readonly code = "CLAIM_NOT_ACTIVE";

	public constructor(public readonly claimId: string) {
		super("Claim is not active");
	}
}

export class ClaimExpiredError extends DomainError {
	public readonly code = "CLAIM_EXPIRED";

	public constructor(public readonly claimId: string) {
		super("Claim expired");
	}
}

/** The customer already holds as many live claims of the reward as `rules.maxUsePerUser` allows. */
export class ClaimLimitReachedError extends DomainError {
	public readonly code = "CLAIM_LIMIT_REACHED";

	public constructor(public readonly limit: number) {
		super(`You can hold at most ${String(limit)} claim(s) of this reward`, { limit });
	}
}

export class LegalAcceptanceRequiredError extends DomainError {
	public readonly code = "LEGAL_ACCEPTANCE_REQUIRED";

	public constructor() {
		super("Accept terms before claiming");
	}
}

export class OtpRequiredError extends DomainError {
	public readonly code = "OTP_REQUIRED";

	public constructor() {
		super("OTP required for this phone number");
	}
}

/** No live challenge for this phone and reward (none sent, expired, or already used). */
export class OtpMissingError extends DomainError {
	public readonly code = "OTP_INVALID";

	public constructor() {
		super("OTP expired or missing");
	}
}

export class OtpInvalidError extends DomainError {
	public readonly code = "OTP_INVALID";

	public constructor() {
		super("Invalid OTP");
	}
}

/** Every attempt the challenge allows is used (D09). */
export class OtpAttemptsExhaustedError extends DomainError {
	public readonly code = "OTP_RATE_LIMITED";

	public constructor() {
		super("Too many OTP attempts");
	}
}

/** The signed-in account no longer exists. */
export class ClaimantNotFoundError extends DomainError {
	public readonly code = "USER_NOT_FOUND";

	public constructor() {
		super("User not found");
	}
}

/** A claim presented at checkout stopped being redeemable before the bill committed (a concurrent redemption or expiry won). */
export class ClaimNoLongerRedeemableError extends DomainError {
	public readonly code = "CLAIM_NOT_ACTIVE";

	public constructor(public readonly claimId: string) {
		super("Claim is not active");
	}
}

/** The merchant banned this customer from its rewards: a new claim is refused (the customer is told, the reason is not). */
export class ClaimCustomerBannedError extends DomainError {
	public readonly code = "CLAIM_CUSTOMER_BANNED";

	public constructor() {
		super("This business no longer offers you its rewards");
	}
}

/** The reward's merchant does not operate (suspended, banned or not yet live): answered like a missing reward, as the marketplace hides it. */
export class ClaimRewardUnavailableError extends DomainError {
	public readonly code = "REWARD_NOT_FOUND";

	public constructor(public readonly rewardId: string) {
		super("Reward not found");
	}
}
