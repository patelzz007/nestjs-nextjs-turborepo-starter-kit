import { describe, expect, it } from "vitest";

import type { FeatureFlagSetting } from "@workspace/shared";

import { CUSTOMER_TIERS_FEATURE, SHOWCASE_FEATURE, isShowcaseEnabled, MERCHANT_INVITES_FEATURE, resolveEnabledFeatureFlags, type FeatureFlagEnv } from "../feature-flags";

const INVITES_OFF = { merchantInvitesOffered: false };

describe("isShowcaseEnabled", () => {
	it("serves the gallery in development and test builds when nothing is configured", () => {
		expect(isShowcaseEnabled({ NODE_ENV: "development", ADMIN_SHOWCASE: undefined })).toBe(true);
		expect(isShowcaseEnabled({ NODE_ENV: "test", ADMIN_SHOWCASE: undefined })).toBe(true);
	});

	it("keeps it out of a production deployment unless it is switched on", () => {
		expect(isShowcaseEnabled({ NODE_ENV: "production", ADMIN_SHOWCASE: undefined })).toBe(false);
		expect(isShowcaseEnabled({ NODE_ENV: "production", ADMIN_SHOWCASE: "true" })).toBe(true);
	});

	it("lets the switch turn it off anywhere", () => {
		expect(isShowcaseEnabled({ NODE_ENV: "development", ADMIN_SHOWCASE: "false" })).toBe(false);
	});
});

describe("resolveEnabledFeatureFlags", () => {
	it("lists the gallery's flag only while the gallery is served", () => {
		expect(resolveEnabledFeatureFlags({ NODE_ENV: "development", ADMIN_SHOWCASE: undefined }, INVITES_OFF)).toEqual([SHOWCASE_FEATURE, CUSTOMER_TIERS_FEATURE]);
		expect(resolveEnabledFeatureFlags({ NODE_ENV: "production", ADMIN_SHOWCASE: undefined }, INVITES_OFF)).toEqual([CUSTOMER_TIERS_FEATURE]);
	});

	it("lists merchant invites only while the API offers them (multi-tenant)", () => {
		expect(resolveEnabledFeatureFlags({ NODE_ENV: "production", ADMIN_SHOWCASE: undefined }, { merchantInvitesOffered: true })).toEqual([
			MERCHANT_INVITES_FEATURE,
			CUSTOMER_TIERS_FEATURE,
		]);
		expect(resolveEnabledFeatureFlags({ NODE_ENV: "production", ADMIN_SHOWCASE: undefined }, INVITES_OFF)).not.toContain(MERCHANT_INVITES_FEATURE);
	});

	it("has customer tiers on out of the box (ADR 085)", () => {
		expect(resolveEnabledFeatureFlags({ NODE_ENV: "production", ADMIN_SHOWCASE: undefined }, INVITES_OFF)).toContain(CUSTOMER_TIERS_FEATURE);
	});
});

describe("resolveEnabledFeatureFlags with runtime settings (enhancement 5.6)", () => {
	const PRODUCTION: FeatureFlagEnv = { NODE_ENV: "production", ADMIN_SHOWCASE: undefined };
	const TIERS_OFF: FeatureFlagSetting = { key: "customer-tiers", mode: "OFF", percentage: null };

	it("lets a setting turn a flag on or off over its deployment default, and DEFAULT change nothing", () => {
		expect(
			resolveEnabledFeatureFlags(PRODUCTION, INVITES_OFF, {
				settings: [{ key: "showcase", mode: "ON", percentage: null }, TIERS_OFF],
				subjectId: null,
			}),
		).toEqual([SHOWCASE_FEATURE]);
		expect(
			resolveEnabledFeatureFlags(
				PRODUCTION,
				{ merchantInvitesOffered: true },
				{ settings: [{ key: "merchant-invites", mode: "OFF", percentage: null }, TIERS_OFF], subjectId: null },
			),
		).toEqual([]);
		expect(
			resolveEnabledFeatureFlags(
				PRODUCTION,
				{ merchantInvitesOffered: true },
				{ settings: [{ key: "merchant-invites", mode: "DEFAULT", percentage: null }, TIERS_OFF], subjectId: null },
			),
		).toEqual([MERCHANT_INVITES_FEATURE]);
	});

	it("turns a percentage on only for a known person in its share (and never without one)", () => {
		const settings: readonly FeatureFlagSetting[] = [{ key: "showcase", mode: "PERCENTAGE", percentage: 99 }, TIERS_OFF];
		expect(resolveEnabledFeatureFlags(PRODUCTION, INVITES_OFF, { settings, subjectId: null })).toEqual([]);
		const people = Array.from({ length: 50 }, (_unused, index) => `0190f0e0-0000-7000-8000-${String(index).padStart(12, "0")}`);
		expect(people.some((subjectId) => resolveEnabledFeatureFlags(PRODUCTION, INVITES_OFF, { settings, subjectId }).includes(SHOWCASE_FEATURE))).toBe(true);
	});

	it("reads a percentage of customer tiers as off for everyone, as the API does", () => {
		const settings: readonly FeatureFlagSetting[] = [{ key: "customer-tiers", mode: "PERCENTAGE", percentage: 99 }];
		const people = Array.from({ length: 50 }, (_unused, index) => `0190f0e0-0000-7000-8000-${String(index).padStart(12, "0")}`);
		expect(people.some((subjectId) => resolveEnabledFeatureFlags(PRODUCTION, INVITES_OFF, { settings, subjectId }).includes(CUSTOMER_TIERS_FEATURE))).toBe(false);
	});
});
