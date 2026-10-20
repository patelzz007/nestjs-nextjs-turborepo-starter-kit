import type { RedemptionInvalidReason } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { AppError } from "../../../../platform/application/errors/app-error";
import { CheckoutIdempotencyKeyReusedError, MultipleCustomersError, RedemptionRefusedError } from "../../domain/errors/pos.errors";
import { redemptionRefused, toPosWireError } from "../errors/pos-refusal.errors";

/** Reason → the code, status and message POS clients already handle. */
const REFUSAL_CASES: readonly (readonly [RedemptionInvalidReason, string, number, string])[] = [
	["ALREADY_REDEEMED", "ALREADY_REDEEMED", 409, "Already redeemed"],
	["EXPIRED", "CLAIM_EXPIRED", 422, "Claim expired"],
	["NOT_VALID_AT_STORE", "REWARD_NOT_VALID_AT_STORE", 422, "This reward is not valid at this store"],
	["STORE_REQUIRED", "STORE_REQUIRED", 422, "This reward is only valid at selected stores; register this terminal to its store before redeeming it"],
];

describe("pos refusal wire errors", () => {
	it.each(REFUSAL_CASES)("answers %s with its legacy code, status and message", (reason, code, httpStatus, message) => {
		expect(redemptionRefused(reason, "claim-1")).toMatchObject({ code, httpStatus, message, details: { claimId: "claim-1" } });
		expect(toPosWireError(new RedemptionRefusedError(reason, "claim-1"))).toMatchObject({ code, httpStatus });
	});

	it("answers a reused idempotency key as IDEMPOTENCY_KEY_REUSED (409) naming the sale", () => {
		expect(toPosWireError(new CheckoutIdempotencyKeyReusedError("sale-1"))).toMatchObject({
			code: "IDEMPOTENCY_KEY_REUSED",
			httpStatus: 409,
			message: "This idempotency key was already used for a different checkout",
			details: { saleId: "sale-1" },
		});
	});

	it("leaves every other error as it is", () => {
		const error = new MultipleCustomersError();
		expect(toPosWireError(error)).toBe(error);
		expect(toPosWireError(new RedemptionRefusedError("EXPIRED", "claim-1"))).toBeInstanceOf(AppError);
	});
});
