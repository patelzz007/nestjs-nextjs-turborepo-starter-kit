import { DEFAULT_TIER_RULES } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { tierRulesOf } from "../tier-settings.mapper";

describe("tierRulesOf", () => {
	it("answers the launch rules while no row exists", () => {
		expect(tierRulesOf(null)).toStrictEqual(DEFAULT_TIER_RULES);
	});

	it("reads only the rule columns of a row selected with more (who changed it, why)", () => {
		const row = { ...DEFAULT_TIER_RULES, goldThreshold: 30, reason: "Raised Gold", updatedAt: BigInt(1), updatedBy: "staff-1" };
		expect(tierRulesOf(row)).toStrictEqual({ ...DEFAULT_TIER_RULES, goldThreshold: 30 });
	});

	it("fails loudly on a stored row the rules cannot accept", () => {
		expect(() => tierRulesOf({ ...DEFAULT_TIER_RULES, diamondThreshold: 1 })).toThrow();
	});
});
