import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { InvalidMinorUnitsError, RewardRulesInvalidError } from "../errors/reward.errors";
import { MinorUnits } from "../value-objects/minor-units.value-object";
import { nextUpdatedAt } from "../value-objects/reward-concurrency-token.value-object";
import { RewardRulesValue } from "../value-objects/reward-rules.value-object";
import { NOW } from "./reward-state.fixture";

describe("MinorUnits", () => {
	it.each([0, 1, Number.MAX_SAFE_INTEGER])("accepts %s sen", (amount) => {
		expect(MinorUnits.of(amount).amount).toBe(amount);
	});

	it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])("refuses %s", (amount) => {
		expect(() => MinorUnits.of(amount)).toThrow(InvalidMinorUnitsError);
	});

	it("rounds ringgit to the sen and converts back", () => {
		expect(MinorUnits.fromMajor(12.345).amount).toBe(1235);
		expect(MinorUnits.of(1250).toMajor()).toBe(12.5);
		expect(MinorUnits.of(5).equals(MinorUnits.of(5))).toBe(true);
		expect(MinorUnits.of(5).equals(MinorUnits.of(6))).toBe(false);
	});
});

describe("RewardRulesValue", () => {
	it("splits the minimum spend into its own column", () => {
		const rules = RewardRulesValue.fromApi({ minSpendMyr: 20, maxUsePerUser: 2 });
		expect(rules.minSpend?.amount).toBe(2000);
		expect(rules.storedRules()).toEqual({ maxUsePerUser: 2 });
		expect(rules.maxUsePerUser()).toBe(2);
		expect(rules.toApi()).toEqual({ maxUsePerUser: 2, minSpendMyr: 20 });
	});

	it("stores no JSON when only the minimum spend is set, and no rules at all as null", () => {
		expect(RewardRulesValue.fromApi({ minSpendMyr: 5 }).storedRules()).toBeNull();
		expect(RewardRulesValue.none().toApi()).toBeNull();
		expect(RewardRulesValue.none().maxUsePerUser()).toBeNull();
	});

	it("reads stored columns back, the column winning over a legacy JSON minimum", () => {
		expect(RewardRulesValue.fromStorage({ maxUsePerUser: 1 }, 1500).toApi()).toEqual({ maxUsePerUser: 1, minSpendMyr: 15 });
		expect(RewardRulesValue.fromStorage({ minSpendMyr: 9 }, 1500).toApi()).toEqual({ minSpendMyr: 15 });
		expect(RewardRulesValue.fromStorage({ minSpendMyr: 9 }, null).toApi()).toEqual({ minSpendMyr: 9 });
		expect(RewardRulesValue.fromStorage(null, null).toApi()).toBeNull();
	});

	it("refuses stored JSON that does not match the rules schema", () => {
		expect(() => RewardRulesValue.fromStorage({ maxUsePerUser: -1 }, null)).toThrow(RewardRulesInvalidError);
		expect(() => RewardRulesValue.fromStorage({ unknownRule: 1 }, null)).toThrow(RewardRulesInvalidError);
	});
});

describe("nextUpdatedAt", () => {
	it("uses now when it is later than the loaded value", () => {
		expect(nextUpdatedAt(epochMs(NOW - 1), NOW)).toBe(NOW);
	});

	it("always moves strictly past the loaded value", () => {
		expect(nextUpdatedAt(NOW, NOW)).toBe(NOW + 1);
		expect(nextUpdatedAt(epochMs(NOW + 5), NOW)).toBe(NOW + 6);
	});
});
