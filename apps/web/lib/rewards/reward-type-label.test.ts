import { describe, expect, it } from "vitest";

import { rewardTypeLabel } from "@/lib/rewards/reward-type-label";

describe("rewardTypeLabel", () => {
	it("names a discount in sentence case", () => {
		expect(rewardTypeLabel("DISCOUNT")).toBe("Discount");
	});

	it("names a free item in sentence case", () => {
		expect(rewardTypeLabel("FREE_ITEM")).toBe("Free item");
	});
});
