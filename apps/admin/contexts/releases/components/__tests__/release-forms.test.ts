import { epochMs, PROMOTION_FORMAT_VERSION } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { configFormSchema, isValueTextValid, parseJsonObject } from "../config-form";
import { CreateExperimentFormSchema, UpdateExperimentFormSchema } from "../experiment-form";
import { CreateGroupFormSchema, editGroupFormSchema } from "../flag-group-form";
import { FlagRulesFormSchema } from "../flag-rules-form";
import { readPromotionFile } from "../promotion-import";
import { emptyCondition, epochFromLocal, localFromEpoch, splitValues } from "../rule-editor/condition-editor";
import { clampPercentage } from "../rule-editor/rollout-editor";
import { moved, newFlagRule } from "../rule-editor/rule-list-editor";
import { SubjectFormSchema } from "../subject-check-card";

const REASON = "Agreed at the release review";
const RULE_ID = "0193b9f4-6f2a-7c4e-9a1d-3c5e7f9b1d2f";
const BOLD = JSON.stringify({ emphasis: "bold" });
const STANDARD = JSON.stringify({ emphasis: "standard" });

const PLAN = {
	key: " bold-claim-button ",
	configKey: "reward-claim-cta",
	name: "Bold claim button",
	hypothesis: "A bolder button leads more people to claim",
	trafficPercentage: 50,
	variants: [
		{ valueName: "standard", allocation: 50 },
		{ valueName: "bold", allocation: 50 },
	],
	controlValueName: "standard",
	primaryMetric: "reward-claims",
	guardrailMetrics: ["reward-redemptions"],
	plannedEndAt: "",
	reason: REASON,
} satisfies Record<string, string | number | readonly object[] | readonly string[]>;

describe("rule editor helpers", () => {
	it("splits comma and space separated values, dropping empty pieces", () => {
		expect(splitValues(" a, b  c,,d ")).toEqual(["a", "b", "c", "d"]);
		expect(splitValues("")).toEqual([]);
	});

	it("reads a datetime-local value as epoch ms and back, and an empty or broken one as none", () => {
		const at = epochFromLocal("2026-11-17T09:30");
		expect(at).not.toBeNull();
		expect(localFromEpoch(at)).toBe("2026-11-17T09:30");
		expect(epochFromLocal("")).toBeNull();
		expect(epochFromLocal("not a date")).toBeNull();
		expect(localFromEpoch(null)).toBe("");
	});

	it("keeps a typed share inside 0–100, an empty box reading 0", () => {
		expect(clampPercentage("42")).toBe(42);
		expect(clampPercentage("250")).toBe(100);
		expect(clampPercentage("-5")).toBe(0);
		expect(clampPercentage("")).toBe(0);
	});

	it("moves a rule up or down, and leaves the list as it is at either end", () => {
		expect(moved(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
		expect(moved(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
		expect(moved(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
		expect(moved(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
	});

	it("starts a new rule for everyone, fully on, named by its position", () => {
		const rule = newFlagRule(2);
		expect(rule).toMatchObject({ name: "Rule 3", conditions: [], rollout: { kind: "FIXED", percentage: 100 } });
	});

	it("starts each kind of condition empty, a group condition on the first group", () => {
		expect(emptyCondition("EMAIL_DOMAIN", "")).toEqual({ attribute: "EMAIL_DOMAIN", operator: "IN", values: [] });
		expect(emptyCondition("FLAG_GROUP", "beta-testers")).toEqual({ attribute: "FLAG_GROUP", operator: "IN_GROUP", groupKey: "beta-testers" });
		expect(emptyCondition("TIME", "")).toEqual({ attribute: "TIME", from: null, until: null });
		expect(emptyCondition("PLATFORM_STAFF", "")).toEqual({ attribute: "PLATFORM_STAFF", is: true });
	});
});

describe("FlagRulesFormSchema", () => {
	it("accepts rules with a time window and a reason", () => {
		const parsed = FlagRulesFormSchema.safeParse({
			rules: [{ id: RULE_ID, name: "Staff first", conditions: [{ attribute: "TIME", from: epochMs(1), until: epochMs(2) }], rollout: { kind: "FIXED", percentage: 10 } }],
			reason: REASON,
		});
		expect(parsed.success).toBe(true);
	});

	it("refuses a change without a real reason", () => {
		expect(FlagRulesFormSchema.safeParse({ rules: [], reason: "x" }).success).toBe(false);
	});
});

describe("config form", () => {
	it("reads JSON objects only", () => {
		expect(parseJsonObject(BOLD)).toEqual({ emphasis: "bold" });
		expect(parseJsonObject("[1]")).toBeNull();
		expect(parseJsonObject("{")).toBeNull();
	});

	it("checks a value against the config's declared shape", () => {
		expect(isValueTextValid("reward-claim-cta", BOLD)).toBe(true);
		expect(isValueTextValid("reward-claim-cta", JSON.stringify({ emphasis: "loud" }))).toBe(false);
	});

	it("turns the form into a revision, every rule naming one of its values", () => {
		const schema = configFormSchema("reward-claim-cta");
		const rule = { id: RULE_ID, name: "Everyone", conditions: [], rollout: { kind: "FIXED", percentage: 100 }, valueName: "bold" } satisfies Record<
			string,
			string | readonly object[] | object
		>;
		const parsed = schema.parse({
			values: [
				{ name: "standard", text: STANDARD },
				{ name: "bold", text: BOLD },
			],
			rules: [rule],
			reason: REASON,
		});
		expect(parsed.content.values).toEqual([
			{ name: "standard", value: { emphasis: "standard" } },
			{ name: "bold", value: { emphasis: "bold" } },
		]);
		expect(schema.safeParse({ values: [{ name: "standard", text: STANDARD }], rules: [rule], reason: REASON }).success).toBe(false);
	});

	it("refuses two values of one name", () => {
		const schema = configFormSchema("reward-claim-cta");
		const twice = [
			{ name: "bold", text: BOLD },
			{ name: "bold", text: BOLD },
		];
		expect(schema.safeParse({ values: twice, rules: [], reason: REASON }).success).toBe(false);
	});
});

describe("flag group form", () => {
	it("creates a listed group with its unit, and a condition group with its conditions", () => {
		const base = { key: " beta-testers ", name: "Beta testers", description: "People trying changes first", unit: "USER", conditions: [], reason: REASON } satisfies Record<
			string,
			string | readonly object[]
		>;
		expect(CreateGroupFormSchema.parse({ ...base, kind: "LIST" })).toMatchObject({ key: "beta-testers", definition: { kind: "LIST", unit: "USER" } });
		const staff = [{ attribute: "PLATFORM_STAFF", is: true }] satisfies readonly object[];
		expect(CreateGroupFormSchema.parse({ ...base, kind: "CONDITIONS", conditions: staff })).toMatchObject({ definition: { kind: "CONDITIONS", conditions: staff } });
	});

	it("edits a listed group without conditions, and a condition group with them", () => {
		const form = {
			key: "beta-testers",
			name: "Beta",
			description: "",
			kind: "CONDITIONS",
			unit: "USER",
			conditions: [{ attribute: "PLATFORM_STAFF", is: true }],
			reason: REASON,
		} satisfies Record<string, string | readonly object[]>;
		expect(editGroupFormSchema("LIST").parse(form)).toMatchObject({ conditions: null });
		expect(editGroupFormSchema("CONDITIONS").parse(form)).toMatchObject({ conditions: [{ attribute: "PLATFORM_STAFF", is: true }] });
	});
});

describe("experiment form", () => {
	it("plans an experiment: trimmed key, no planned end when left empty", () => {
		const parsed = CreateExperimentFormSchema.parse(PLAN);
		expect(parsed).toMatchObject({ key: "bold-claim-button", configKey: "reward-claim-cta", plannedEndAt: null });
	});

	it("refuses variants that don't share 100%, or a control that isn't one of them", () => {
		expect(
			CreateExperimentFormSchema.safeParse({
				...PLAN,
				variants: [
					{ valueName: "standard", allocation: 50 },
					{ valueName: "bold", allocation: 40 },
				],
			}).success,
		).toBe(false);
		expect(CreateExperimentFormSchema.safeParse({ ...PLAN, controlValueName: "compact" }).success).toBe(false);
	});

	it("saves a draft's plan without its key or config, which can't change", () => {
		const parsed = UpdateExperimentFormSchema.parse({ ...PLAN, plannedEndAt: "2026-12-01T12:00" });
		expect(parsed).not.toHaveProperty("key");
		expect(parsed).not.toHaveProperty("configKey");
		expect(parsed.plannedEndAt).toBe(epochFromLocal("2026-12-01T12:00"));
	});
});

describe("subject check form", () => {
	it("reads empty boxes and 'none' as not set", () => {
		const parsed = SubjectFormSchema.parse({ userId: " ", tenantId: "", locationId: "", deviceId: "", app: "web", platform: "none", appVersion: "", locale: "none" });
		expect(parsed).toMatchObject({ userId: null, app: "web", platform: null, locale: null });
	});

	it("keeps a chosen platform and language", () => {
		const parsed = SubjectFormSchema.parse({ userId: "", tenantId: "", locationId: "", deviceId: "", app: "mobile", platform: "ios", appVersion: "2.1.0", locale: "ms" });
		expect(parsed).toMatchObject({ platform: "ios", appVersion: "2.1.0", locale: "ms" });
	});
});

describe("readPromotionFile", () => {
	const file = {
		kind: "FLAG",
		key: "web-activity",
		content: { kind: "FLAG", rules: [] },
		formatVersion: PROMOTION_FORMAT_VERSION,
		environment: "staging",
		exportedAt: 1_700_000_000_000,
		revision: 3,
		groups: [],
		listedGroupKeys: [],
	} satisfies Record<string, string | number | object>;

	it("reads an exported file", () => {
		const read = readPromotionFile(JSON.stringify(file));
		expect(read).toEqual({ file: { ...file, exportedAt: epochMs(file.exportedAt) } });
	});

	it("says what's wrong with text that isn't JSON, or a file of another format", () => {
		expect(readPromotionFile("{ nope")).toEqual({ problem: "This isn't JSON: paste the whole exported file." });
		expect(readPromotionFile(JSON.stringify({ ...file, formatVersion: 2 }))).toHaveProperty("problem");
	});
});
