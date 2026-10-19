import { HttpStatus } from "@nestjs/common";
import type { RedemptionInvalidReason } from "@workspace/shared";

import { AppError } from "../../../../platform/application/errors/app-error";
import { CheckoutIdempotencyKeyReusedError, RedemptionRefusedError } from "../../domain/errors/pos.errors";

/**
 * The code, status and message each refusal reason had before the migration (POS clients branch on
 * them). `CLAIM_EXPIRED` is 422 here but 400 in claims' own registry, which is why these refusals are
 * re-coded here instead of mapped by the domain error code.
 */
const REFUSALS: Readonly<Record<RedemptionInvalidReason, { readonly code: string; readonly httpStatus: HttpStatus; readonly message: string }>> = {
	ALREADY_REDEEMED: { code: "ALREADY_REDEEMED", httpStatus: HttpStatus.CONFLICT, message: "Already redeemed" },
	EXPIRED: { code: "CLAIM_EXPIRED", httpStatus: HttpStatus.UNPROCESSABLE_ENTITY, message: "Claim expired" },
	NOT_VALID_AT_STORE: { code: "REWARD_NOT_VALID_AT_STORE", httpStatus: HttpStatus.UNPROCESSABLE_ENTITY, message: "This reward is not valid at this store" },
	STORE_REQUIRED: {
		code: "STORE_REQUIRED",
		httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
		message: "This reward is only valid at selected stores; register this terminal to its store before redeeming it",
	},
};

/** A claim that cannot be redeemed here and now, answered with its reason's legacy code. */
export function redemptionRefused(reason: RedemptionInvalidReason, claimId: string): AppError {
	const { code, httpStatus, message } = REFUSALS[reason];
	return new AppError({ code, httpStatus, message, details: { claimId } });
}

/**
 * A concurrent checkout of ANOTHER store recorded a sale under this idempotency key: the key is unique
 * across the organization, but a store-limited till cannot read that store's sale to replay it. Answered
 * like a reused key (409), without naming a sale the caller may not see.
 */
export function idempotencyKeyTakenElsewhere(): AppError {
	return new AppError({ code: "IDEMPOTENCY_KEY_REUSED", httpStatus: HttpStatus.CONFLICT, message: "This idempotency key was already used for a different checkout" });
}

/** Re-codes the two pos domain errors whose wire codes predate the migration; anything else is returned unchanged. */
export function toPosWireError(error: Error): Error {
	if (error instanceof RedemptionRefusedError) {
		return redemptionRefused(error.reason, error.claimId);
	}
	if (error instanceof CheckoutIdempotencyKeyReusedError) {
		return new AppError({
			code: "IDEMPOTENCY_KEY_REUSED",
			httpStatus: HttpStatus.CONFLICT,
			message: "This idempotency key was already used for a different checkout",
			details: { saleId: error.saleId },
		});
	}
	return error;
}
