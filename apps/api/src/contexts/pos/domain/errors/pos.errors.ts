import type { EpochMs, RedemptionInvalidReason } from "@workspace/shared";

import { DomainError } from "../../../../platform/domain/errors/domain-error";
import { DomainErrorCodeSchema } from "../../../../platform/domain/errors/error-codes";

/** Every code the pos domain throws; codes and messages clients already saw are kept byte for byte. */
export const PosDomainErrorCodeSchema = DomainErrorCodeSchema.extract([
	"REDEMPTION_TOKEN_INVALID",
	"REDEMPTION_INPUT_REQUIRED",
	"REDEMPTION_REFUSED",
	"DUPLICATE_REWARD_CODE",
	"MULTIPLE_CUSTOMERS",
	"MIN_SPEND_NOT_MET",
	"POS_CODE_LOCKED",
	"CHECKOUT_IDEMPOTENCY_KEY_REUSED",
	"TERMINAL_NOT_FOUND",
	"TERMINAL_ID_TAKEN",
	"TERMINAL_ID_UNAVAILABLE",
	"TERMINAL_STORE_NOT_ACTIVE",
	"PAIRING_CODE_INVALID",
	"API_KEY_NOT_FOUND",
	"API_KEY_LOCATION_REQUIRED",
	"MERCHANT_PROFILE_NOT_FOUND",
	"TENANT_NOT_ACTIVE",
]);

export type PosDomainErrorCode = (typeof PosDomainErrorCodeSchema)["options"][number];

/** An unknown code, and another merchant's code, are answered alike (no cross-merchant oracle). */
export class RedemptionCodeNotFoundError extends DomainError {
	public readonly code = "REDEMPTION_TOKEN_INVALID";

	public constructor() {
		super("This code is not valid for this merchant");
	}
}

export class RedemptionInputRequiredError extends DomainError {
	public readonly code = "REDEMPTION_INPUT_REQUIRED";

	public constructor() {
		super("At least one reward code is required");
	}
}

/**
 * A presented claim cannot be redeemed here and now. The application layer answers it with the
 * reason's own code and status (`ALREADY_REDEEMED` 409, `CLAIM_EXPIRED` / `REWARD_NOT_VALID_AT_STORE` /
 * `STORE_REQUIRED` 422), byte-compatible with what POS clients already handle.
 */
export class RedemptionRefusedError extends DomainError {
	public readonly code = "REDEMPTION_REFUSED";

	public constructor(
		public readonly reason: RedemptionInvalidReason,
		public readonly claimId: string,
	) {
		super(`Claim ${claimId} cannot be redeemed (${reason})`, { claimId });
	}
}

export class DuplicateRewardCodeError extends DomainError {
	public readonly code = "DUPLICATE_REWARD_CODE";

	public constructor(public readonly claimId: string) {
		super("The same reward was presented twice", { claimId });
	}
}

export class MultipleCustomersError extends DomainError {
	public readonly code = "MULTIPLE_CUSTOMERS";

	public constructor() {
		super("All rewards on one bill must belong to the same customer");
	}
}

export class MinSpendNotMetError extends DomainError {
	public readonly code = "MIN_SPEND_NOT_MET";

	public constructor(rewardTitle: string, claimId: string, minSpendMinor: number) {
		super(`"${rewardTitle}" needs a bill of at least ${String(minSpendMinor)} (minor units)`, { claimId, minSpendMinor });
	}
}

/** The API key guessed too many unknown backup codes; redemption with it is paused until `lockedUntil`. */
export class PosCodeLockedError extends DomainError {
	public readonly code = "POS_CODE_LOCKED";

	public constructor(public readonly lockedUntil: EpochMs) {
		super("Too many invalid backup codes from this API key. Redemption with this key is paused.", { lockedUntil });
	}
}

/** A retried idempotency key must carry the identical bill; a reused key with another bill is a client bug. */
export class CheckoutIdempotencyKeyReusedError extends DomainError {
	public readonly code = "CHECKOUT_IDEMPOTENCY_KEY_REUSED";

	public constructor(public readonly saleId: string) {
		super("This idempotency key was already used for a different checkout", { saleId });
	}
}

/**
 * A concurrent checkout already recorded a sale under this idempotency key (the unique index refused
 * the insert). Part of the `RewardSaleRepository` contract, never answered as is: the caller's
 * transaction rolls back and the winner is replayed, or, when the winner belongs to a store the caller
 * cannot read, answered as a reused key (409). A plain `Error` on purpose: it has no wire code.
 */
export class SaleIdempotencyKeyTakenError extends Error {
	public constructor(public readonly idempotencyKey: string) {
		super(`A sale already exists for idempotency key ${idempotencyKey}`);
		this.name = "SaleIdempotencyKeyTakenError";
	}
}

/** Another store's till (for a store-limited member), another tenant's, and a missing one are answered alike. */
export class TerminalNotFoundError extends DomainError {
	public readonly code = "TERMINAL_NOT_FOUND";

	public constructor() {
		super("Terminal not found");
	}
}

/** Another live till of this tenant already uses the terminal id (the database decides, race-free). */
export class TerminalIdTakenError extends DomainError {
	public readonly code = "TERMINAL_ID_TAKEN";

	public constructor() {
		super("Another terminal already uses this terminal id");
	}
}

/** No free generated terminal id was found within the bounded attempts. */
export class TerminalIdUnavailableError extends DomainError {
	public readonly code = "TERMINAL_ID_UNAVAILABLE";

	public constructor() {
		super("Could not allocate a terminal id, please retry");
	}
}

/** The till's store is closed (or being closed): a till is never registered at a store that no longer trades. */
export class TerminalStoreNotActiveError extends DomainError {
	public readonly code = "TERMINAL_STORE_NOT_ACTIVE";

	public constructor() {
		super("This store is closed; register the terminal at an open store");
	}
}

/** Unknown, expired and already-used pairing codes all look the same to the till (no oracle for which codes exist). */
export class PairingCodeInvalidError extends DomainError {
	public readonly code = "PAIRING_CODE_INVALID";

	public constructor() {
		super("This pairing code is invalid or has expired");
	}
}

/** Another store's key, a tenant-wide key for a store-limited member, and a missing one are answered alike. */
export class ApiKeyNotFoundError extends DomainError {
	public readonly code = "API_KEY_NOT_FOUND";

	public constructor() {
		super("API key not found");
	}
}

/** Only a member with access to every store may mint a key that works at every store. */
export class ApiKeyLocationRequiredError extends DomainError {
	public readonly code = "API_KEY_LOCATION_REQUIRED";

	public constructor() {
		super("Choose one of your stores — only members with access to every store can create a tenant-wide key");
	}
}

export class MerchantProfileNotFoundError extends DomainError {
	public readonly code = "MERCHANT_PROFILE_NOT_FOUND";

	public constructor() {
		super("Merchant profile not found");
	}
}

/** A suspended / deactivated merchant may pair no till and use no key: one 403 for every path. */
export class TenantNotActiveError extends DomainError {
	public readonly code = "TENANT_NOT_ACTIVE";

	public constructor() {
		super("This merchant is not active");
	}
}
