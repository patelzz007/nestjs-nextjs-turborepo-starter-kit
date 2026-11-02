import { describe, expect, it } from "vitest";

import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";
import { redemptionOfferOf } from "../policies/redemption-offer.policy";

const REWARD_ID = "reward-1";
const LATTE = { name: "Latte", sku: "BEV-LATTE-12OZ" };

describe("redemptionOfferOf", () => {
	it("reports a discount as its percent off", () => {
		expect(redemptionOfferOf(REWARD_ID, { rewardType: "DISCOUNT", rewardValue: 15, freeItem: null })).toEqual({ type: "DISCOUNT", percentOff: 15 });
	});

	it("reports cashback in the sale currency's minor units (RM 15 → 1500 sen)", () => {
		expect(redemptionOfferOf(REWARD_ID, { rewardType: "CASHBACK", rewardValue: 15, freeItem: null })).toEqual({ type: "CASHBACK", amountMinor: 1500, currency: "MYR" });
	});

	it("reports bonus points as points", () => {
		expect(redemptionOfferOf(REWARD_ID, { rewardType: "POINTS", rewardValue: 200, freeItem: null })).toEqual({ type: "POINTS", points: 200 });
	});

	it("reports a free item and a buy one, get one with the item's name and SKU", () => {
		expect(redemptionOfferOf(REWARD_ID, { rewardType: "FREE_ITEM", rewardValue: 2, freeItem: LATTE })).toEqual({ type: "FREE_ITEM", quantity: 2, item: LATTE });
		expect(redemptionOfferOf(REWARD_ID, { rewardType: "BOGO", rewardValue: 1, freeItem: LATTE })).toEqual({ type: "BOGO", freeQuantity: 1, item: LATTE });
	});

	it("refuses a free item reward stored without its item instead of reporting it without one", () => {
		expect(() => redemptionOfferOf(REWARD_ID, { rewardType: "FREE_ITEM", rewardValue: 1, freeItem: null })).toThrow(CorruptAggregateStateError);
		expect(() => redemptionOfferOf(REWARD_ID, { rewardType: "BOGO", rewardValue: 1, freeItem: null })).toThrow(CorruptAggregateStateError);
	});
});
