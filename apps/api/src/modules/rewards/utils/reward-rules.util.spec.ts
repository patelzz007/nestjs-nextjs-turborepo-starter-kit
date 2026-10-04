import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { minSpendMyrToMinor, rewardRulesFromStorage, RewardRulesInvalidError, toStoredRewardRules } from "./reward-rules.util";

describe("reward rules storage", () => {
	it("converts ringgit (including fractions) to whole sen", () => {
		expect(minSpendMyrToMinor(20)).toBe(2000);
		expect(minSpendMyrToMinor(12.5)).toBe(1250);
		expect(minSpendMyrToMinor(0.1 + 0.2)).toBe(30);
	});

	it("stores the minimum spend in its integer column, never in the JSON", () => {
		expect(toStoredRewardRules({ minSpendMyr: 35, maxUsePerUser: 2 })).toEqual({ rules: { maxUsePerUser: 2 }, minSpendMinor: 3500 });
		expect(toStoredRewardRules({ minSpendMyr: 0 })).toEqual({ rules: Prisma.DbNull, minSpendMinor: 0 });
		expect(toStoredRewardRules({})).toEqual({ rules: Prisma.DbNull, minSpendMinor: null });
	});

	it("derives the API rules from both columns", () => {
		expect(rewardRulesFromStorage({ maxUsePerUser: 2 }, 3550)).toEqual({ maxUsePerUser: 2, minSpendMyr: 35.5 });
		expect(rewardRulesFromStorage(null, null)).toBeNull();
		expect(rewardRulesFromStorage(null, 0)).toEqual({ minSpendMyr: 0 });
	});

	it("throws on stored rules that fail the schema instead of reading them as 'no rules'", () => {
		expect(() => rewardRulesFromStorage({ maxUsePerUser: -1 }, null)).toThrow(RewardRulesInvalidError);
		expect(() => rewardRulesFromStorage({ unknownRule: true }, null)).toThrow(RewardRulesInvalidError);
	});
});
