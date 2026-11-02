import { describe, expect, it } from "vitest";

import { RedemptionCheckoutItemSchema, RedemptionOfferSchema, RedemptionPreviewResponseSchema } from "../redemption";

const LATTE = { name: "Latte", sku: "BEV-LATTE-12OZ" };
const CLAIM_ID = "0193f2c4-0000-7000-8000-0000000000c1";
const REWARD_ID = "0193f2c4-0000-7000-8000-0000000000c2";
const REDEMPTION_ID = "0193f2c4-0000-7000-8000-0000000000c3";
const EXPIRES_AT = Date.UTC(2027, 0, 1);

describe("a redemption's offer, in POS terms", () => {
	it("reads each reward type's own terms", () => {
		expect(RedemptionOfferSchema.parse({ type: "DISCOUNT", percentOff: 15 })).toEqual({ type: "DISCOUNT", percentOff: 15 });
		expect(RedemptionOfferSchema.parse({ type: "CASHBACK", amountMinor: 1500, currency: "MYR" })).toEqual({ type: "CASHBACK", amountMinor: 1500, currency: "MYR" });
		expect(RedemptionOfferSchema.parse({ type: "POINTS", points: 200 })).toEqual({ type: "POINTS", points: 200 });
		expect(RedemptionOfferSchema.parse({ type: "FREE_ITEM", quantity: 1, item: LATTE })).toEqual({ type: "FREE_ITEM", quantity: 1, item: LATTE });
		expect(RedemptionOfferSchema.parse({ type: "BOGO", freeQuantity: 1, item: LATTE })).toEqual({ type: "BOGO", freeQuantity: 1, item: LATTE });
	});

	it("refuses terms that belong to another type", () => {
		expect(RedemptionOfferSchema.safeParse({ type: "DISCOUNT", amountMinor: 1500 }).success).toBe(false);
		expect(RedemptionOfferSchema.safeParse({ type: "FREE_ITEM", quantity: 1 }).success).toBe(false);
		expect(RedemptionOfferSchema.safeParse({ type: "CASHBACK", amountMinor: 1500 }).success).toBe(false);
	});

	it("is part of the validate answer and of each redeemed reward", () => {
		const offer = { type: "FREE_ITEM", quantity: 1, item: LATTE };
		const preview = RedemptionPreviewResponseSchema.parse({
			claimId: CLAIM_ID,
			rewardId: REWARD_ID,
			rewardTitle: "Free latte",
			rewardDescription: "One free latte",
			rewardType: "FREE_ITEM",
			offer,
			termsConditions: null,
			claimExpiresAt: EXPIRES_AT,
			valid: true,
			invalidReason: null,
			minSpendMinor: null,
		});
		expect(preview.offer).toEqual(offer);
		const item = RedemptionCheckoutItemSchema.parse({
			redemptionId: REDEMPTION_ID,
			claimId: CLAIM_ID,
			rewardId: REWARD_ID,
			rewardTitle: "Free latte",
			rewardType: "FREE_ITEM",
			offer,
		});
		expect(item.offer).toEqual(offer);
	});
});
