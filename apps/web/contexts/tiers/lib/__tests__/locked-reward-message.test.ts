import { DEFAULT_TIER_RULES } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { lockedRewardMessage, redemptionsToUnlock } from "../locked-reward-message";

const SILVER_PAGE = { countedRedemptions: 12, rules: DEFAULT_TIER_RULES };

describe("redemptionsToUnlock", () => {
	it("is the gap to the reward's minimum tier, never below zero", () => {
		expect(redemptionsToUnlock("GOLD", SILVER_PAGE)).toBe(DEFAULT_TIER_RULES.goldThreshold - 12);
		expect(redemptionsToUnlock("SILVER", SILVER_PAGE)).toBe(0);
	});
});

describe("lockedRewardMessage", () => {
	it("asks a signed-out visitor to sign in", () => {
		expect(lockedRewardMessage("GOLD", { kind: "signed-out" })).toBe("A Gold reward. Sign in to see your tier.");
	});

	it("tells a customer how many more redemptions unlock it, singular for one", () => {
		expect(lockedRewardMessage("GOLD", { kind: "signed-in", tier: "SILVER", page: SILVER_PAGE })).toBe("A Gold reward. You're Silver: 13 more redemptions to unlock it.");
		expect(lockedRewardMessage("GOLD", { kind: "signed-in", tier: "SILVER", page: { ...SILVER_PAGE, countedRedemptions: 24 } })).toBe(
			"A Gold reward. You're Silver: 1 more redemption to unlock it.",
		);
	});

	it("names the customer's tier alone until their tier page is read", () => {
		expect(lockedRewardMessage("DIAMOND", { kind: "signed-in", tier: "BRONZE", page: null })).toBe("A Diamond reward. You're Bronze.");
	});
});
