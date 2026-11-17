import { describe, expect, it } from "vitest";

import {
	CustomerTierSchema,
	customerTierRank,
	DEFAULT_TIER_RULES,
	ENTRY_CUSTOMER_TIER,
	isTierAtLeast,
	nextCustomerTier,
	TierRulesSchema,
	tierForCount,
	tierThreshold,
	UpdateTierSettingsSchema,
	type TierRules,
} from "../customer-tier";

const REASON = "Raising Gold after the first quarter";

describe("tier order", () => {
	it("ranks Bronze lowest and Diamond highest, and starts everyone at Bronze", () => {
		expect(["BRONZE", "SILVER", "GOLD", "DIAMOND"].map((tier) => customerTierRank(CustomerTierSchema.parse(tier)))).toStrictEqual([0, 1, 2, 3]);
		expect(ENTRY_CUSTOMER_TIER).toBe("BRONZE");
	});

	it("lets a tier reach its own minimum and every lower one, never a higher one", () => {
		expect(isTierAtLeast("GOLD", "GOLD")).toBe(true);
		expect(isTierAtLeast("DIAMOND", "GOLD")).toBe(true);
		expect(isTierAtLeast("SILVER", "GOLD")).toBe(false);
		expect(isTierAtLeast("BRONZE", "BRONZE")).toBe(true);
	});

	it("names the next tier up, and none above Diamond", () => {
		expect(nextCustomerTier("BRONZE")).toBe("SILVER");
		expect(nextCustomerTier("GOLD")).toBe("DIAMOND");
		expect(nextCustomerTier("DIAMOND")).toBeNull();
	});
});

describe("tierForCount", () => {
	it("gives the highest tier the count reaches under the default rules (10 / 25 / 50)", () => {
		expect(tierForCount(DEFAULT_TIER_RULES, 0)).toBe("BRONZE");
		expect(tierForCount(DEFAULT_TIER_RULES, 9)).toBe("BRONZE");
		expect(tierForCount(DEFAULT_TIER_RULES, 10)).toBe("SILVER");
		expect(tierForCount(DEFAULT_TIER_RULES, 24)).toBe("SILVER");
		expect(tierForCount(DEFAULT_TIER_RULES, 25)).toBe("GOLD");
		expect(tierForCount(DEFAULT_TIER_RULES, 50)).toBe("DIAMOND");
		expect(tierForCount(DEFAULT_TIER_RULES, 500)).toBe("DIAMOND");
	});

	it("reads each tier's threshold, Bronze needing none", () => {
		expect([tierThreshold(DEFAULT_TIER_RULES, "BRONZE"), tierThreshold(DEFAULT_TIER_RULES, "SILVER"), tierThreshold(DEFAULT_TIER_RULES, "DIAMOND")]).toStrictEqual([
			0, 10, 50,
		]);
	});
});

describe("tier rules", () => {
	it("accepts the defaults", () => {
		expect(TierRulesSchema.parse(DEFAULT_TIER_RULES)).toStrictEqual(DEFAULT_TIER_RULES);
	});

	it("refuses thresholds that do not rise from Silver to Gold to Diamond", () => {
		const flat: TierRules = { ...DEFAULT_TIER_RULES, goldThreshold: 10 };
		expect(TierRulesSchema.safeParse(flat).success).toBe(false);
		const inverted: TierRules = { ...DEFAULT_TIER_RULES, diamondThreshold: 20 };
		expect(UpdateTierSettingsSchema.safeParse({ ...inverted, reason: REASON }).error?.issues.map((issue) => issue.path)).toStrictEqual([["diamondThreshold"]]);
	});

	it("needs a reason for a change, and bounded values", () => {
		expect(UpdateTierSettingsSchema.safeParse({ ...DEFAULT_TIER_RULES, reason: "short" }).success).toBe(false);
		expect(UpdateTierSettingsSchema.safeParse({ ...DEFAULT_TIER_RULES, windowDays: 7, reason: REASON }).success).toBe(false);
		expect(UpdateTierSettingsSchema.safeParse({ ...DEFAULT_TIER_RULES, perMerchantCap: 0, reason: REASON }).success).toBe(false);
		expect(UpdateTierSettingsSchema.parse({ ...DEFAULT_TIER_RULES, holdDays: 0, reason: REASON }).holdDays).toBe(0);
	});
});
