import { type ConfigRevisionContent, type FlagRule } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { bucketOf, BUCKETS, variantAt } from "../evaluation/bucketing";
import { FlagRulesInvalidError } from "../errors/feature-flag.errors";
import { approvalsRequired, assertValidConfigContent, assertValidFlagRules, groupKeysOf } from "../policies/flag-rules.policy";
import { READY_TO_REMOVE_AFTER_MS, readyToRemove, type FlagStateForRemoval } from "../policies/ready-to-remove.policy";

const RULE = "019b76da-a800-7000-8000-0000000000a1";
const NOW = 1_800_000_000_000;

function everyone(percentage: number): FlagRule {
	return { id: RULE, name: "Everyone", conditions: [], rollout: { kind: "FIXED", percentage } };
}

describe("bucketing", () => {
	it("keeps a bucket stable and inside 0–99", () => {
		const bucket = bucketOf("web-activity", "someone");
		expect(bucketOf("web-activity", "someone")).toBe(bucket);
		expect(bucket).toBeGreaterThanOrEqual(0);
		expect(bucket).toBeLessThan(BUCKETS);
	});

	it("gives each variant consecutive buckets as wide as its allocation", () => {
		const variants = [
			{ name: "a", allocation: 30 },
			{ name: "b", allocation: 70 },
		];
		expect(variantAt(variants, 0)?.name).toBe("a");
		expect(variantAt(variants, 29)?.name).toBe("a");
		expect(variantAt(variants, 30)?.name).toBe("b");
		expect(variantAt([{ name: "a", allocation: 10 }], 50)).toBeNull();
	});
});

describe("flag rule policy", () => {
	it("refuses rules naming groups that don't exist", () => {
		const rules: FlagRule[] = [{ ...everyone(100), conditions: [{ attribute: "FLAG_GROUP", operator: "IN_GROUP", groupKey: "beta" }] }];
		expect(groupKeysOf(rules)).toStrictEqual(["beta"]);
		expect(() => {
			assertValidFlagRules("web-activity", rules, new Set());
		}).toThrow(FlagRulesInvalidError);
		expect(() => {
			assertValidFlagRules("web-activity", rules, new Set(["beta"]));
		}).not.toThrow();
	});

	it("refuses a customer-tiers rule reading the customer's tier (it would ask itself)", () => {
		const rules: FlagRule[] = [{ ...everyone(100), conditions: [{ attribute: "CUSTOMER_TIER", operator: "IN", values: ["GOLD"] }] }];
		expect(() => {
			assertValidFlagRules("customer-tiers", rules, new Set());
		}).toThrow(FlagRulesInvalidError);
		expect(() => {
			assertValidFlagRules("web-activity", rules, new Set());
		}).not.toThrow();
	});

	it("checks every config value against the config's declared shape", () => {
		const valid: ConfigRevisionContent = { kind: "CONFIG", values: [{ name: "bold", value: { emphasis: "bold" } }], rules: [] };
		expect(() => {
			assertValidConfigContent("reward-claim-cta", valid, new Set());
		}).not.toThrow();
		const invalid: ConfigRevisionContent = { kind: "CONFIG", values: [{ name: "neon", value: { emphasis: "neon" } }], rules: [] };
		expect(() => {
			assertValidConfigContent("reward-claim-cta", invalid, new Set());
		}).toThrow(/neon/u);
	});

	it("needs approvals in production only", () => {
		expect(approvalsRequired("production")).toBe(true);
		expect(approvalsRequired("staging")).toBe(false);
		expect(approvalsRequired("development")).toBe(false);
	});
});

describe("ready to remove", () => {
	const settled = NOW - READY_TO_REMOVE_AFTER_MS;
	const base: FlagStateForRemoval = { killed: false, lastChangedAt: settled, rules: [everyone(100)], overrideCount: 0, lastExposureAt: NOW, trackedSince: settled };

	it("reads always on, always off and killed after 30 settled days", () => {
		expect(readyToRemove(base, NOW)).toBe("ALWAYS_ON");
		expect(readyToRemove({ ...base, rules: [everyone(0)] }, NOW)).toBe("ALWAYS_OFF");
		expect(readyToRemove({ ...base, killed: true }, NOW)).toBe("KILLED");
	});

	it("waits while a change is recent, an override says otherwise, or a rule has conditions", () => {
		expect(readyToRemove({ ...base, lastChangedAt: NOW - 1 }, NOW)).toBeNull();
		expect(readyToRemove({ ...base, overrideCount: 1 }, NOW)).toBeNull();
		expect(readyToRemove({ ...base, rules: [{ ...everyone(100), conditions: [{ attribute: "APP", operator: "IN", values: ["web"] }] }] }, NOW)).toBeNull();
	});

	it("reads never checked after 30 quiet days", () => {
		expect(readyToRemove({ ...base, rules: [], lastExposureAt: settled }, NOW)).toBe("NEVER_CHECKED");
		expect(readyToRemove({ ...base, rules: [], lastExposureAt: null, lastChangedAt: null, trackedSince: null }, NOW)).toBeNull();
	});
});
