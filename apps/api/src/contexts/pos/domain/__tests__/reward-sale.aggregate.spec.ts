import { epochMs, type RedemptionInvalidReason } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { RewardSale } from "../aggregates/reward-sale.aggregate";
import {
	CheckoutIdempotencyKeyReusedError,
	DuplicateRewardCodeError,
	MinSpendNotMetError,
	MultipleCustomersError,
	RedemptionInputRequiredError,
	RedemptionRefusedError,
} from "../errors/pos.errors";
import { SaleCheckedOut } from "../events/pos.events";
import type { RedeemableClaim } from "../policies/redemption-eligibility.policy";
import { newSale, NOW, POINT, presented, STORE_A, STORE_B } from "./pos-domain.fixture";

/** Each refusal reason and a claim that earns it. */
const REFUSAL_CASES: readonly (readonly [RedemptionInvalidReason, Partial<RedeemableClaim>])[] = [
	["ALREADY_REDEEMED", { claimStatus: "REDEEMED" }],
	["EXPIRED", { claimStatus: "EXPIRED" }],
	["EXPIRED", { claimExpiresAt: epochMs(NOW - 1) }],
	["NOT_VALID_AT_STORE", { locationScopeType: "SELECTED", locationIds: [STORE_B] }],
];

/** Each refusal reason that depends on the till's store, with the store it is checked out at. */
const STORE_REFUSAL_CASES: readonly (readonly [RedemptionInvalidReason, string | null])[] = [
	["NOT_VALID_AT_STORE", STORE_B],
	["STORE_REQUIRED", null],
];

describe("RewardSale.checkout", () => {
	it("records the bill with its lines sorted by claim id, and SaleCheckedOut", () => {
		const sale = RewardSale.checkout(newSale([presented({ claimId: "claim-b", rewardId: "reward-b" }, "MANUAL"), presented({ claimId: "claim-a" })]), NOW);

		expect(sale.snapshot()).toMatchObject({
			id: "sale-1",
			customerUserId: "customer-1",
			paidAt: NOW,
			lines: [
				{ claimId: "claim-a", rewardId: "reward-1", method: "SCAN" },
				{ claimId: "claim-b", rewardId: "reward-b", method: "MANUAL" },
			],
		});
		const events = sale.pullEvents();
		expect(events).toHaveLength(1);
		const [event] = events;
		expect(event).toBeInstanceOf(SaleCheckedOut);
		expect(event).toMatchObject({
			saleId: "sale-1",
			tenantId: POINT.tenantId,
			terminalId: POINT.terminalId,
			billTotalMinor: 5_000,
			claimIds: ["claim-a", "claim-b"],
		});
		expect(sale.pullEvents()).toEqual([]);
	});

	it.each(STORE_REFUSAL_CASES)("refuses a store-limited reward as %s at a till of store %s", (reason, locationId) => {
		const attempt = (): RewardSale =>
			RewardSale.checkout(newSale([presented({ locationScopeType: "SELECTED", locationIds: [STORE_A] })], { point: { ...POINT, locationId } }), NOW);
		expect(attempt).toThrow(new RedemptionRefusedError(reason, "claim-1"));
	});

	it("accepts a claim expiring a millisecond from now", () => {
		expect(RewardSale.checkout(newSale([presented({ claimExpiresAt: epochMs(NOW + 1) })]), NOW).snapshot().lines).toHaveLength(1);
	});

	it("refuses an empty bill", () => {
		expect(() => RewardSale.checkout(newSale([]), NOW)).toThrow(RedemptionInputRequiredError);
	});

	it("refuses the same claim presented twice", () => {
		expect(() => RewardSale.checkout(newSale([presented(), presented({}, "MANUAL")]), NOW)).toThrow(DuplicateRewardCodeError);
	});

	it("refuses claims of different customers on one bill", () => {
		expect(() => RewardSale.checkout(newSale([presented(), presented({ claimId: "claim-2", customerUserId: "customer-2" })]), NOW)).toThrow(MultipleCustomersError);
	});

	it.each(REFUSAL_CASES)("refuses a claim that is not redeemable here now (%s)", (reason, patch) => {
		const attempt = (): RewardSale => RewardSale.checkout(newSale([presented(patch)]), NOW);
		expect(attempt).toThrow(RedemptionRefusedError);
		expect(attempt).toThrow(new RedemptionRefusedError(reason, "claim-1"));
	});

	it("checks each reward's minimum against the whole bill on its own (minimums do not add up)", () => {
		const sale = newSale([presented({ minSpendMinor: 3_000 }), presented({ claimId: "claim-2", minSpendMinor: 3_000 })], { billTotalMinor: 3_000 });

		expect(RewardSale.checkout(sale, NOW).snapshot().lines).toHaveLength(2);
		expect(() => RewardSale.checkout({ ...sale, billTotalMinor: 2_999 }, NOW)).toThrow(MinSpendNotMetError);
	});

	it("carries the minimum and the claim on a refused minimum", () => {
		expect(() => RewardSale.checkout(newSale([presented({ minSpendMinor: 9_000 })]), NOW)).toThrow(
			expect.objectContaining({ details: { claimId: "claim-1", minSpendMinor: 9_000 } }),
		);
	});
});

describe("RewardSale.assertReplayOf", () => {
	it("replays only the identical request", () => {
		expect(() => {
			RewardSale.assertReplayOf({ saleId: "sale-1", requestHash: "hash-1" }, "hash-1");
		}).not.toThrow();
		expect(() => {
			RewardSale.assertReplayOf({ saleId: "sale-1", requestHash: "hash-1" }, "hash-2");
		}).toThrow(CheckoutIdempotencyKeyReusedError);
	});
});
