import { DomainErrorCodeSchema } from "../../../../platform/domain/errors/error-codes";

import { DomainError } from "../../../../platform/domain/errors/domain-error";

/**
 * Every code the rewards domain throws. Codes and messages that clients already saw (from the
 * `HttpException`s these replace) are kept byte for byte, and so are their absent details.
 */
export const RewardsDomainErrorCodeSchema = DomainErrorCodeSchema.extract([
	"REWARD_NOT_FOUND",
	"REWARD_NOT_EDITABLE",
	"REWARD_NOT_DRAFT",
	"REWARD_NOT_PENDING",
	"REWARD_TRANSITION_NOT_ALLOWED",
	"REWARD_REJECTION_REASON_BLANK",
	"REWARD_QUANTITY_BELOW_RESERVED",
	"REWARD_QUANTITY_INVALID",
	"REWARD_AMOUNT_INVALID",
	"REWARD_RULES_INVALID",
	"REWARD_IMAGES_INVALID",
	"REWARD_IMAGE_NOT_FOUND",
	"REWARD_LOCATION_INVALID",
	"TENANT_LOCATION_FORBIDDEN",
	"REWARD_EXPIRED",
	"REWARD_OUT_OF_STOCK",
	"REWARD_RESERVATION_MISSING",
	"VALIDATION_ERROR",
	"CORRUPT_AGGREGATE_STATE",
]);

export type RewardsDomainErrorCode = (typeof RewardsDomainErrorCodeSchema)["options"][number];

/** Missing, deleted, in another tenant, or outside the caller's stores — all answered alike (no existence oracle). */
export class RewardNotFoundError extends DomainError {
	public readonly code = "REWARD_NOT_FOUND";

	public constructor(public readonly rewardId: string) {
		super("Reward not found");
	}
}

export class RewardNotEditableError extends DomainError {
	public readonly code = "REWARD_NOT_EDITABLE";

	public constructor(public readonly rewardId: string) {
		super("Reward cannot be edited in current status");
	}
}

export class RewardNotDraftError extends DomainError {
	public readonly code = "REWARD_NOT_DRAFT";

	public constructor(public readonly rewardId: string) {
		super("Only draft rewards can be published");
	}
}

export class RewardNotPendingReviewError extends DomainError {
	public readonly code = "REWARD_NOT_PENDING";

	public constructor(public readonly rewardId: string) {
		super("Reward is not pending review");
	}
}

/** A status change the lifecycle (`DRAFT → PENDING_REVIEW → PUBLISHED`, `PENDING_REVIEW → DRAFT`) does not allow. */
export class RewardTransitionNotAllowedError extends DomainError {
	public readonly code = "REWARD_TRANSITION_NOT_ALLOWED";

	public constructor(rewardId: string, from: string, to: string) {
		super("That reward status change is not allowed.", { rewardId, from, to });
	}
}

/** A rejection must say why: a blank reason is refused. */
export class RewardRejectionReasonBlankError extends DomainError {
	public readonly code = "REWARD_REJECTION_REASON_BLANK";

	public constructor() {
		super("A rejection reason cannot be blank.");
	}
}

export class RewardQuantityBelowReservedError extends DomainError {
	public readonly code = "REWARD_QUANTITY_BELOW_RESERVED";

	public constructor(rewardId: string) {
		super("Quantity cannot drop below the number already reserved.", { rewardId });
	}
}

/** A quantity that is not a whole number of at least one unit. */
export class RewardQuantityInvalidError extends DomainError {
	public readonly code = "REWARD_QUANTITY_INVALID";

	public constructor(quantity: number) {
		super("A reward quantity must be a whole number of at least 1.", { quantity });
	}
}

/** A money amount that is not a whole, non-negative number of minor units (sen). */
export class InvalidMinorUnitsError extends DomainError {
	public readonly code = "REWARD_AMOUNT_INVALID";

	public constructor() {
		super("An amount must be a whole, non-negative number of sen.");
	}
}

/** A reward's stored `rules` JSON does not match `RewardRulesSchema` — an integrity fault, never read as "no rules". */
export class RewardRulesInvalidError extends DomainError {
	public readonly code = "REWARD_RULES_INVALID";

	public constructor(issues: string) {
		super("Stored reward rules are invalid.", { issues });
	}
}

/** An image a reward names is not one of the tenant's ready, published reward images. */
export class RewardImagesInvalidError extends DomainError {
	public readonly code = "REWARD_IMAGES_INVALID";

	public constructor(public readonly fileIds: readonly string[]) {
		super("One or more images are not ready or do not belong to this tenant. Upload them again.");
	}
}

export class RewardImageNotFoundError extends DomainError {
	public readonly code = "REWARD_IMAGE_NOT_FOUND";

	public constructor() {
		super("Reward image not found");
	}
}

export class RewardLocationInvalidError extends DomainError {
	public readonly code = "REWARD_LOCATION_INVALID";

	public constructor() {
		super("One or more selected stores are invalid for this tenant");
	}
}

/** A store-limited caller named a store it does not manage (or asked for every store). */
export class RewardLocationForbiddenError extends DomainError {
	public readonly code = "TENANT_LOCATION_FORBIDDEN";

	public constructor() {
		super("You can only offer rewards at the stores you manage — select one or more of your stores");
	}
}

export class RewardExpiredError extends DomainError {
	public readonly code = "REWARD_EXPIRED";

	public constructor() {
		super("Reward expired");
	}
}

/** Nothing left to claim when the claim was checked. */
export class RewardSoldOutError extends DomainError {
	public readonly code = "REWARD_OUT_OF_STOCK";

	public constructor() {
		super("This reward is sold out");
	}
}

/** The unit was gone by the time the claim tried to reserve it (or the reward stopped being claimable). */
export class RewardJustSoldOutError extends DomainError {
	public readonly code = "REWARD_OUT_OF_STOCK";

	public constructor() {
		super("This reward just sold out");
	}
}

/** A release or redemption with no reserved unit to take it from — the counters drifted from the claims. */
export class RewardReservationMissingError extends DomainError {
	public readonly code = "REWARD_RESERVATION_MISSING";

	public constructor(rewardId: string) {
		super("The reward has no reserved unit to release or redeem.", { rewardId });
	}
}

/** An acceptance must name the terms and privacy versions it accepts. */
export class LegalVersionBlankError extends DomainError {
	public readonly code = "VALIDATION_ERROR";

	public constructor() {
		super("Name the terms and privacy versions being accepted.");
	}
}
