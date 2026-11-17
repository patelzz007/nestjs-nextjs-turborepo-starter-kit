import { epochMs, type Condition, type ConfigRevisionContent, type ConfigRule, type FlagRule } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { CatalogIndex } from "../catalog/catalog-index";
import { EMPTY_FLAG_CATALOG, type FlagCatalog } from "../catalog/flag-catalog";
import { bucketOf, rolloutSeed } from "../evaluation/bucketing";
import { NO_FACTS, type EvaluationSubject } from "../evaluation/evaluation-subject";
import { evaluateConfig, evaluateFlag, nextChangeAt, requiredAttributes } from "../evaluation/flag-evaluator";

const NOW = 1_800_000_000_000;
const USER = "019b76da-a800-7000-8000-000000000001";
const OTHER_USER = "019b76da-a800-7000-8000-000000000002";
const TENANT = "019b76da-a800-7000-8000-000000000010";
const LOCATION = "019b76da-a800-7000-8000-000000000020";
const RULE_A = "019b76da-a800-7000-8000-0000000000a1";
const RULE_B = "019b76da-a800-7000-8000-0000000000b1";
const EXPERIMENT = "019b76da-a800-7000-8000-0000000000e1";

function subject(overrides: Partial<EvaluationSubject> = {}): EvaluationSubject {
	return {
		userId: USER,
		tenantId: TENANT,
		locationId: LOCATION,
		deviceId: null,
		app: "web",
		platform: "web",
		appVersion: null,
		locale: "en",
		environment: "development",
		now: NOW,
		facts: NO_FACTS,
		...overrides,
	};
}

function rule(id: string, conditions: Condition[], percentage: number): FlagRule {
	return { id, name: `Rule ${id.slice(-2)}`, conditions, rollout: { kind: "FIXED", percentage } };
}

function index(catalog: Partial<FlagCatalog>): CatalogIndex {
	return new CatalogIndex({ ...EMPTY_FLAG_CATALOG, ...catalog });
}

describe("evaluateFlag", () => {
	it("answers the code default when nothing decides", () => {
		expect(evaluateFlag("web-activity", index({}), subject()).result).toStrictEqual({ key: "web-activity", on: true, source: "DEFAULT", revision: null, ruleId: null });
		expect(evaluateFlag("showcase", index({}), subject()).result.on).toBe(false);
	});

	it("lets the kill switch beat every override and rule", () => {
		const catalog = index({
			killSwitches: ["web-activity"],
			overrides: [{ key: "web-activity", unit: "USER", subjectId: USER, on: true }],
			flagRevisions: [{ key: "web-activity", number: 1, rules: [rule(RULE_A, [], 100)] }],
		});
		const decision = evaluateFlag("web-activity", catalog, subject());
		expect(decision.result).toMatchObject({ on: false, source: "KILL_SWITCH" });
		expect(decision.trace).toHaveLength(1);
	});

	it("takes the most specific override: user, then location, then tenant", () => {
		const overrides: FlagCatalog["overrides"] = [
			{ key: "till-redemption", unit: "TENANT", subjectId: TENANT, on: true },
			{ key: "till-redemption", unit: "LOCATION", subjectId: LOCATION, on: false },
		];
		expect(evaluateFlag("till-redemption", index({ overrides }), subject()).result).toMatchObject({ on: false, source: "OVERRIDE_LOCATION" });
		expect(evaluateFlag("till-redemption", index({ overrides }), subject({ locationId: null })).result).toMatchObject({ on: true, source: "OVERRIDE_TENANT" });
		const withUser = index({ overrides: [...overrides, { key: "till-redemption", unit: "USER", subjectId: USER, on: true }] });
		expect(evaluateFlag("till-redemption", withUser, subject()).result.source).toBe("OVERRIDE_USER");
	});

	it("lets the first matching rule decide, with the rule and revision that did", () => {
		const catalog = index({
			flagRevisions: [
				{
					key: "showcase",
					number: 4,
					rules: [
						rule(RULE_A, [{ attribute: "ENVIRONMENT", operator: "IN", values: ["production"] }], 100),
						rule(RULE_B, [{ attribute: "APP", operator: "IN", values: ["web"] }], 100),
					],
				},
			],
		});
		const decision = evaluateFlag("showcase", catalog, subject());
		expect(decision.result).toStrictEqual({ key: "showcase", on: true, source: "RULE", revision: 4, ruleId: RULE_B });
		expect(decision.trace.find((step) => step.label === "Rule a1")).toMatchObject({ matched: false, failedAttribute: "ENVIRONMENT" });
	});

	it("answers off for a matched rule's subjects outside its share (it doesn't fall through)", () => {
		const catalog = index({ flagRevisions: [{ key: "web-activity", number: 1, rules: [rule(RULE_A, [], 0), rule(RULE_B, [], 100)] }] });
		expect(evaluateFlag("web-activity", catalog, subject()).result).toMatchObject({ on: false, source: "RULE", ruleId: RULE_A });
	});

	it("puts a subject in a stable bucket, and a rising share only ever adds subjects", () => {
		const share = bucketOf(rolloutSeed("web-activity"), USER);
		const at = (percentage: number): boolean =>
			evaluateFlag("web-activity", index({ flagRevisions: [{ key: "web-activity", number: 1, rules: [rule(RULE_A, [], percentage)] }] }), subject()).result.on;
		expect(at(share)).toBe(false);
		expect(at(share + 1)).toBe(true);
		expect(at(share + 1)).toBe(at(share + 1));
	});

	it("skips a partial rule when the subject has no id for the flag's rollout unit", () => {
		const catalog = index({ flagRevisions: [{ key: "web-activity", number: 1, rules: [rule(RULE_A, [], 50)] }] });
		const decision = evaluateFlag("web-activity", catalog, subject({ userId: null }));
		expect(decision.result.source).toBe("DEFAULT");
		expect(decision.trace.find((step) => step.step === "RULE")?.detail).toContain("user");
	});

	it("never matches a condition on a fact the subject lacks, whatever its operator", () => {
		const notIn = rule(RULE_A, [{ attribute: "EMAIL_DOMAIN", operator: "NOT_IN", values: ["example.com"] }], 100);
		const catalog = index({ flagRevisions: [{ key: "showcase", number: 1, rules: [notIn] }] });
		expect(evaluateFlag("showcase", catalog, subject()).result.source).toBe("DEFAULT");
		expect(evaluateFlag("showcase", catalog, subject({ facts: { ...NO_FACTS, emailDomain: "rewardhub.test" } })).result).toMatchObject({ on: true, source: "RULE" });
	});

	it("matches groups: listed by unit id, or by their own conditions", () => {
		const catalog = index({
			groups: [
				{ key: "beta", kind: "LIST", unit: "USER", members: [OTHER_USER] },
				{ key: "staff", kind: "CONDITIONS", conditions: [{ attribute: "PLATFORM_STAFF", is: true }] },
			],
			flagRevisions: [
				{
					key: "showcase",
					number: 1,
					rules: [
						rule(RULE_A, [{ attribute: "FLAG_GROUP", operator: "IN_GROUP", groupKey: "beta" }], 100),
						rule(RULE_B, [{ attribute: "FLAG_GROUP", operator: "IN_GROUP", groupKey: "staff" }], 100),
					],
				},
			],
		});
		expect(evaluateFlag("showcase", catalog, subject({ userId: OTHER_USER })).result.ruleId).toBe(RULE_A);
		expect(evaluateFlag("showcase", catalog, subject({ facts: { ...NO_FACTS, platformStaff: true } })).result.ruleId).toBe(RULE_B);
		expect(evaluateFlag("showcase", catalog, subject()).result.source).toBe("DEFAULT");
	});

	it("reads app versions, permissions, tiers, platforms, locales and time windows", () => {
		const check = (condition: Condition, over: Partial<EvaluationSubject>): boolean =>
			evaluateFlag("showcase", index({ flagRevisions: [{ key: "showcase", number: 1, rules: [rule(RULE_A, [condition], 100)] }] }), subject(over)).result.on;
		expect(check({ attribute: "APP_VERSION", operator: "AT_LEAST", version: "2.0.0" }, { appVersion: "2.1.0" })).toBe(true);
		expect(check({ attribute: "APP_VERSION", operator: "BELOW", version: "2.0.0" }, { appVersion: "2.1.0" })).toBe(false);
		expect(
			check(
				{ attribute: "PERMISSION", operator: "HAS", permission: { action: "LIST", resource: "FEATURE_FLAG" } },
				{ facts: { ...NO_FACTS, permissions: [{ action: "LIST", resource: "FEATURE_FLAG" }] } },
			),
		).toBe(true);
		expect(check({ attribute: "CUSTOMER_TIER", operator: "IN", values: ["GOLD", "DIAMOND"] }, { facts: { ...NO_FACTS, customerTier: "DIAMOND" } })).toBe(true);
		expect(check({ attribute: "PLATFORM", operator: "IN", values: ["ios"] }, { platform: "android" })).toBe(false);
		expect(check({ attribute: "LOCALE", operator: "NOT_IN", values: ["ms"] }, { locale: "en" })).toBe(true);
		expect(check({ attribute: "TIME", from: epochMs(NOW - 1), until: epochMs(NOW + 1) }, {})).toBe(true);
		expect(check({ attribute: "TIME", from: epochMs(NOW + 1), until: null }, {})).toBe(false);
		expect(check({ attribute: "USER_ID", operator: "IN", values: [USER] }, {})).toBe(true);
		expect(check({ attribute: "TENANT_ID", operator: "NOT_IN", values: [TENANT] }, {})).toBe(false);
		expect(check({ attribute: "LOCATION_ID", operator: "IN", values: [LOCATION] }, {})).toBe(true);
	});

	it("works a scheduled rollout out from the clock", () => {
		const scheduled: FlagRule = {
			id: RULE_A,
			name: "Ramp",
			conditions: [],
			rollout: {
				kind: "SCHEDULED",
				steps: [
					{ at: epochMs(NOW - 10), percentage: 0 },
					{ at: epochMs(NOW + 10), percentage: 100 },
				],
			},
		};
		const catalog = index({ flagRevisions: [{ key: "web-activity", number: 1, rules: [scheduled] }] });
		expect(evaluateFlag("web-activity", catalog, subject()).result.on).toBe(false);
		expect(evaluateFlag("web-activity", catalog, subject({ now: NOW + 10 })).result.on).toBe(true);
		expect(nextChangeAt(catalog, ["web-activity"], [], NOW)).toBe(NOW + 10);
		expect(nextChangeAt(catalog, ["web-activity"], [], NOW + 10)).toBeNull();
	});

	it("decides a deployment-wide flag for no one in particular: overrides and per-person rules never apply", () => {
		const catalog = index({
			overrides: [{ key: "customer-tiers", unit: "USER", subjectId: USER, on: false }],
			flagRevisions: [{ key: "customer-tiers", number: 1, rules: [rule(RULE_A, [{ attribute: "USER_ID", operator: "IN", values: [USER] }], 100)] }],
		});
		expect(evaluateFlag("customer-tiers", catalog, subject()).result).toMatchObject({ on: true, source: "DEFAULT" });
	});

	it("lists the attributes rules read, including a condition group's", () => {
		const catalog = index({
			groups: [{ key: "staff", kind: "CONDITIONS", conditions: [{ attribute: "PLATFORM_STAFF", is: true }] }],
			flagRevisions: [{ key: "showcase", number: 1, rules: [rule(RULE_A, [{ attribute: "FLAG_GROUP", operator: "IN_GROUP", groupKey: "staff" }], 100)] }],
		});
		expect([...requiredAttributes(catalog, ["showcase"], [])].sort()).toStrictEqual(["FLAG_GROUP", "PLATFORM_STAFF"]);
		expect(requiredAttributes(catalog, ["web-activity"], []).size).toBe(0);
	});
});

describe("evaluateConfig", () => {
	const mobileBold: ConfigRule = { ...rule(RULE_A, [{ attribute: "APP", operator: "IN", values: ["mobile"] }], 100), valueName: "bold" };
	const content: ConfigRevisionContent = {
		kind: "CONFIG",
		values: [
			{ name: "standard", value: { emphasis: "standard" } },
			{ name: "bold", value: { emphasis: "bold" } },
		],
		rules: [mobileBold],
	};

	it("answers the code default, a rule's value, or the default for subjects outside a rule's share", () => {
		const catalog = index({ configRevisions: [{ key: "reward-claim-cta", number: 2, content }] });
		expect(evaluateConfig("reward-claim-cta", catalog, subject()).result).toMatchObject({ valueName: null, value: { emphasis: "standard" }, source: "DEFAULT", revision: 2 });
		expect(evaluateConfig("reward-claim-cta", catalog, subject({ app: "mobile" })).result).toMatchObject({
			valueName: "bold",
			value: { emphasis: "bold" },
			source: "RULE",
			ruleId: RULE_A,
		});
		const none = index({
			configRevisions: [{ key: "reward-claim-cta", number: 2, content: { ...content, rules: [{ ...mobileBold, rollout: { kind: "FIXED", percentage: 0 } }] } }],
		});
		expect(evaluateConfig("reward-claim-cta", none, subject({ app: "mobile" })).result).toMatchObject({ valueName: null, source: "RULE" });
	});

	it("gives a running experiment's subjects a stable variant, ahead of the rules", () => {
		const catalog = index({
			configRevisions: [{ key: "reward-claim-cta", number: 2, content }],
			experiments: [
				{
					id: EXPERIMENT,
					configKey: "reward-claim-cta",
					salt: "salt",
					trafficPercentage: 100,
					variants: [
						{ valueName: "standard", allocation: 50 },
						{ valueName: "bold", allocation: 50 },
					],
				},
			],
		});
		const first = evaluateConfig("reward-claim-cta", catalog, subject({ app: "mobile" })).result;
		expect(first).toMatchObject({ source: "EXPERIMENT", experimentId: EXPERIMENT });
		expect(evaluateConfig("reward-claim-cta", catalog, subject({ app: "mobile" })).result.variant).toBe(first.variant);
		expect(evaluateConfig("reward-claim-cta", catalog, subject({ userId: null })).result.source).toBe("DEFAULT");
	});

	it("leaves subjects outside the experiment's traffic to the rules", () => {
		const catalog = index({
			configRevisions: [{ key: "reward-claim-cta", number: 2, content }],
			experiments: [{ id: EXPERIMENT, configKey: "reward-claim-cta", salt: "salt", trafficPercentage: 0, variants: [{ valueName: "bold", allocation: 100 }] }],
		});
		const decision = evaluateConfig("reward-claim-cta", catalog, subject({ app: "mobile" }));
		expect(decision.result.source).toBe("RULE");
		const [first] = decision.trace;
		expect(first).toMatchObject({ step: "EXPERIMENT", matched: false });
	});
});
