import { describe, expect, it } from "vitest";

import { formatRewardOffer, rewardTypeLabel } from "./reward-offer";

describe("formatRewardOffer", () => {
	it("says what the customer gets", () => {
		expect(formatRewardOffer("DISCOUNT", 10)).toBe("10% off");
		// Intl separates the currency symbol with a no-break space, so the amount never wraps away from it.
		expect(formatRewardOffer("CASHBACK", 15)).toBe("RM 15 cashback");
		expect(formatRewardOffer("POINTS", 1500)).toBe("1,500 bonus points");
		expect(formatRewardOffer("BOGO", 1)).toBe("Buy one, get one");
	});

	it("counts free items only when there is more than one", () => {
		expect(formatRewardOffer("FREE_ITEM", 1)).toBe("Free item");
		expect(formatRewardOffer("FREE_ITEM", 3)).toBe("3 free items");
	});
});

describe("rewardTypeLabel", () => {
	it("names every reward type in sentence case", () => {
		expect(rewardTypeLabel("DISCOUNT")).toBe("Discount");
		expect(rewardTypeLabel("CASHBACK")).toBe("Cashback");
		expect(rewardTypeLabel("POINTS")).toBe("Bonus points");
		expect(rewardTypeLabel("FREE_ITEM")).toBe("Free item");
		expect(rewardTypeLabel("BOGO")).toBe("Buy one, get one");
	});
});
