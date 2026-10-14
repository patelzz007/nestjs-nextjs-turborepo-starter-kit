import { RewardTypeSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { getRewardValueField, MIN_SPEND_PREFIX, REWARD_TYPE_OPTIONS } from "@/components/rewards/merchant-reward-form.constants";

describe("REWARD_TYPE_OPTIONS", () => {
	it("offers every reward type exactly once", () => {
		expect(REWARD_TYPE_OPTIONS.map((option) => option.value).sort()).toEqual([...RewardTypeSchema.options].sort());
	});
});

describe("getRewardValueField", () => {
	it("puts the unit next to the number the merchant types", () => {
		expect(getRewardValueField("DISCOUNT")).toEqual({ label: "Discount", suffix: "%" });
		expect(getRewardValueField("CASHBACK")).toEqual({ label: "Cashback", prefix: "RM" });
		expect(getRewardValueField("POINTS")).toEqual({ label: "Bonus points", suffix: "points" });
		expect(getRewardValueField("FREE_ITEM")).toEqual({ label: "Items given", suffix: "items" });
		expect(getRewardValueField("BOGO")).toEqual({ label: "Free items per purchase", suffix: "items" });
	});

	it("labels every reward type's value field", () => {
		expect(RewardTypeSchema.options.every((rewardType) => getRewardValueField(rewardType).label.length > 0)).toBe(true);
	});
});

describe("MIN_SPEND_PREFIX", () => {
	it("is the currency cashback is set in", () => {
		expect(MIN_SPEND_PREFIX).toBe(getRewardValueField("CASHBACK").prefix);
	});
});
