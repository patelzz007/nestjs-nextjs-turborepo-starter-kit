import { describe, expect, it } from "vitest";

import {
	evaluateFeatureFlag,
	evaluateStoreFeatureFlag,
	FEATURE_FLAG_REGISTRY,
	FeatureFlagKeySchema,
	featureFlagBucket,
	PlatformFeatureFlagKeySchema,
	SetFeatureFlagStoreOverrideSchema,
	STORE_FEATURE_FLAG_DEFAULTS,
	StoreFeatureFlagKeySchema,
	UpdateFeatureFlagSchema,
} from "../feature-flags";

const PEOPLE = Array.from({ length: 2_000 }, (_unused, index) => `0190f0e0-0000-7000-8000-${String(index).padStart(12, "0")}`);

describe("featureFlagBucket", () => {
	it("gives a person the same bucket every time, between 0 and 99, different per flag", () => {
		const person = PEOPLE.at(7) ?? "";
		expect(featureFlagBucket("component-gallery", person)).toBe(featureFlagBucket("component-gallery", person));
		expect(PEOPLE.every((id) => featureFlagBucket("merchant-invites", id) >= 0 && featureFlagBucket("merchant-invites", id) < 100)).toBe(true);
		expect(PEOPLE.some((id) => featureFlagBucket("component-gallery", id) !== featureFlagBucket("merchant-invites", id))).toBe(true);
	});

	it("spreads people roughly evenly, so a percentage means about that share", () => {
		const on = PEOPLE.filter((id) => evaluateFeatureFlag("component-gallery", { mode: "PERCENTAGE", percentage: 30 }, false, id)).length / PEOPLE.length;
		expect(on).toBeGreaterThan(0.25);
		expect(on).toBeLessThan(0.35);
	});
});

describe("evaluateFeatureFlag", () => {
	it("follows the default with no setting or DEFAULT, and the setting otherwise", () => {
		expect(evaluateFeatureFlag("component-gallery", undefined, true, null)).toBe(true);
		expect(evaluateFeatureFlag("component-gallery", { mode: "DEFAULT", percentage: null }, false, null)).toBe(false);
		expect(evaluateFeatureFlag("component-gallery", { mode: "ON", percentage: null }, false, null)).toBe(true);
		expect(evaluateFeatureFlag("component-gallery", { mode: "OFF", percentage: null }, true, null)).toBe(false);
	});

	it("needs a person for a percentage, and raising it only ever adds people", () => {
		expect(evaluateFeatureFlag("component-gallery", { mode: "PERCENTAGE", percentage: 99 }, true, null)).toBe(false);
		const at20 = new Set(PEOPLE.filter((id) => evaluateFeatureFlag("component-gallery", { mode: "PERCENTAGE", percentage: 20 }, false, id)));
		const at60 = PEOPLE.filter((id) => evaluateFeatureFlag("component-gallery", { mode: "PERCENTAGE", percentage: 60 }, false, id));
		expect([...at20].every((id) => at60.includes(id))).toBe(true);
	});
});

describe("UpdateFeatureFlagSchema", () => {
	it("takes a percentage with PERCENTAGE only, and always a reason", () => {
		expect(UpdateFeatureFlagSchema.safeParse({ mode: "PERCENTAGE", percentage: 25, reason: "A quarter of staff first" }).success).toBe(true);
		expect(UpdateFeatureFlagSchema.safeParse({ mode: "PERCENTAGE", percentage: null, reason: "A quarter of staff first" }).success).toBe(false);
		expect(UpdateFeatureFlagSchema.safeParse({ mode: "ON", percentage: 25, reason: "Everyone, now please" }).success).toBe(false);
		expect(UpdateFeatureFlagSchema.safeParse({ mode: "ON", percentage: null, reason: "short" }).success).toBe(false);
	});

	it("describes every declared flag", () => {
		expect(Object.keys(FEATURE_FLAG_REGISTRY).sort()).toStrictEqual([...FeatureFlagKeySchema.options].sort());
	});
});

describe("store flags (enhancement 5.11)", () => {
	const none = { merchant: null, branch: null };

	it("lets the branch decide over its merchant, the merchant over the deployment, the deployment over the default", () => {
		expect(evaluateStoreFeatureFlag("till-redemption", { merchant: true, branch: false }, undefined, null)).toBe(false);
		expect(evaluateStoreFeatureFlag("till-redemption", { merchant: false, branch: null }, { mode: "ON", percentage: null }, null)).toBe(false);
		expect(evaluateStoreFeatureFlag("till-redemption", none, { mode: "OFF", percentage: null }, null)).toBe(false);
		expect(evaluateStoreFeatureFlag("till-redemption", none, undefined, null)).toBe(STORE_FEATURE_FLAG_DEFAULTS["till-redemption"]);
	});

	it("splits the flags by where they are decided", () => {
		expect(StoreFeatureFlagKeySchema.options).toEqual(FeatureFlagKeySchema.options.filter((key) => FEATURE_FLAG_REGISTRY[key].scope === "store"));
		expect(PlatformFeatureFlagKeySchema.options).toEqual(FeatureFlagKeySchema.options.filter((key) => FEATURE_FLAG_REGISTRY[key].scope === "platform"));
	});

	it("accepts a merchant-wide or a branch setting, with a reason", () => {
		const tenantId = "0190f0e0-0000-7000-8000-000000000001";
		expect(SetFeatureFlagStoreOverrideSchema.safeParse({ tenantId, locationId: null, enabled: false, reason: "Melaka tills are being replaced" }).success).toBe(true);
		expect(SetFeatureFlagStoreOverrideSchema.safeParse({ tenantId, locationId: null, enabled: false, reason: "short" }).success).toBe(false);
	});
});
