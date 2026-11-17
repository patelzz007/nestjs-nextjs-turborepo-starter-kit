import { DEFAULT_TIER_RULES } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { checkTierSettings, TIER_RULE_FIELDS, TierSettingsDraftFieldSchema, toTierSettingsDraft, withDraftField } from "@/contexts/tiers/lib/tier-settings-form";

const REASON = "Gold was too easy to reach in the pilot";

describe("toTierSettingsDraft", () => {
	it("holds every rule as text, with no reason yet", () => {
		expect(toTierSettingsDraft(DEFAULT_TIER_RULES)).toEqual({
			silverThreshold: "10",
			goldThreshold: "25",
			diamondThreshold: "50",
			windowDays: "365",
			perMerchantCap: "20",
			holdDays: "90",
			warningDays: "14",
			reason: "",
		});
	});
});

describe("TIER_RULE_FIELDS", () => {
	it("lists every rule once, each a box of the form", () => {
		expect(TIER_RULE_FIELDS.map((entry) => entry.field).sort()).toEqual(Object.keys(DEFAULT_TIER_RULES).sort());
		expect(TIER_RULE_FIELDS.every((entry) => TierSettingsDraftFieldSchema.safeParse(entry.field).success)).toBe(true);
	});
});

describe("checkTierSettings", () => {
	it("reads the rules as numbers and keeps the reason", () => {
		const draft = withDraftField(withDraftField(toTierSettingsDraft(DEFAULT_TIER_RULES), "goldThreshold", " 30 "), "reason", REASON);
		expect(checkTierSettings(draft)).toEqual({ ok: true, input: { ...DEFAULT_TIER_RULES, goldThreshold: 30, reason: REASON } });
	});

	it("asks for a reason, and reports a cleared box as missing rather than 0", () => {
		const result = checkTierSettings(withDraftField(toTierSettingsDraft(DEFAULT_TIER_RULES), "holdDays", ""));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.reason).toBeDefined();
			expect(result.errors.holdDays).toBeDefined();
			expect(result.errors.silverThreshold).toBeUndefined();
		}
	});

	it("refuses thresholds that do not rise from Silver to Diamond", () => {
		const draft = withDraftField(withDraftField(toTierSettingsDraft(DEFAULT_TIER_RULES), "goldThreshold", "5"), "reason", REASON);
		const result = checkTierSettings(draft);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.goldThreshold).toBe("Gold needs more redemptions than Silver");
		}
	});
});
