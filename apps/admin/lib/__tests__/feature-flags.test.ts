import { describe, expect, it } from "vitest";

import type { FeatureFlagSetting } from "@workspace/shared";

import { COMPONENT_GALLERY_FEATURE, isComponentGalleryEnabled, MERCHANT_INVITES_FEATURE, resolveEnabledFeatureFlags, type FeatureFlagEnv } from "../feature-flags";

const INVITES_OFF = { merchantInvitesOffered: false };

describe("isComponentGalleryEnabled", () => {
	it("serves the gallery in development and test builds when nothing is configured", () => {
		expect(isComponentGalleryEnabled({ NODE_ENV: "development", ADMIN_COMPONENT_GALLERY: undefined })).toBe(true);
		expect(isComponentGalleryEnabled({ NODE_ENV: "test", ADMIN_COMPONENT_GALLERY: undefined })).toBe(true);
	});

	it("keeps it out of a production deployment unless it is switched on", () => {
		expect(isComponentGalleryEnabled({ NODE_ENV: "production", ADMIN_COMPONENT_GALLERY: undefined })).toBe(false);
		expect(isComponentGalleryEnabled({ NODE_ENV: "production", ADMIN_COMPONENT_GALLERY: "true" })).toBe(true);
	});

	it("lets the switch turn it off anywhere", () => {
		expect(isComponentGalleryEnabled({ NODE_ENV: "development", ADMIN_COMPONENT_GALLERY: "false" })).toBe(false);
	});
});

describe("resolveEnabledFeatureFlags", () => {
	it("lists the gallery's flag only while the gallery is served", () => {
		expect(resolveEnabledFeatureFlags({ NODE_ENV: "development", ADMIN_COMPONENT_GALLERY: undefined }, INVITES_OFF)).toEqual([COMPONENT_GALLERY_FEATURE]);
		expect(resolveEnabledFeatureFlags({ NODE_ENV: "production", ADMIN_COMPONENT_GALLERY: undefined }, INVITES_OFF)).toEqual([]);
	});

	it("lists merchant invites only while the API offers them (multi-tenant)", () => {
		expect(resolveEnabledFeatureFlags({ NODE_ENV: "production", ADMIN_COMPONENT_GALLERY: undefined }, { merchantInvitesOffered: true })).toEqual([MERCHANT_INVITES_FEATURE]);
		expect(resolveEnabledFeatureFlags({ NODE_ENV: "production", ADMIN_COMPONENT_GALLERY: undefined }, INVITES_OFF)).not.toContain(MERCHANT_INVITES_FEATURE);
	});
});

describe("resolveEnabledFeatureFlags with runtime settings (enhancement 5.6)", () => {
	const PRODUCTION: FeatureFlagEnv = { NODE_ENV: "production", ADMIN_COMPONENT_GALLERY: undefined };

	it("lets a setting turn a flag on or off over its deployment default, and DEFAULT change nothing", () => {
		expect(resolveEnabledFeatureFlags(PRODUCTION, INVITES_OFF, { settings: [{ key: "component-gallery", mode: "ON", percentage: null }], subjectId: null })).toEqual([
			COMPONENT_GALLERY_FEATURE,
		]);
		expect(
			resolveEnabledFeatureFlags(PRODUCTION, { merchantInvitesOffered: true }, { settings: [{ key: "merchant-invites", mode: "OFF", percentage: null }], subjectId: null }),
		).toEqual([]);
		expect(
			resolveEnabledFeatureFlags(
				PRODUCTION,
				{ merchantInvitesOffered: true },
				{ settings: [{ key: "merchant-invites", mode: "DEFAULT", percentage: null }], subjectId: null },
			),
		).toEqual([MERCHANT_INVITES_FEATURE]);
	});

	it("turns a percentage on only for a known person in its share (and never without one)", () => {
		const settings: readonly FeatureFlagSetting[] = [{ key: "component-gallery", mode: "PERCENTAGE", percentage: 99 }];
		expect(resolveEnabledFeatureFlags(PRODUCTION, INVITES_OFF, { settings, subjectId: null })).toEqual([]);
		const people = Array.from({ length: 50 }, (_unused, index) => `0190f0e0-0000-7000-8000-${String(index).padStart(12, "0")}`);
		expect(people.some((subjectId) => resolveEnabledFeatureFlags(PRODUCTION, INVITES_OFF, { settings, subjectId }).includes(COMPONENT_GALLERY_FEATURE))).toBe(true);
	});
});
