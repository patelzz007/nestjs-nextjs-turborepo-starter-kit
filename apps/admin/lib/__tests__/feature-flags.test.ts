import { describe, expect, it } from "vitest";

import { COMPONENT_GALLERY_FEATURE, isComponentGalleryEnabled, MERCHANT_INVITES_FEATURE, resolveEnabledFeatureFlags } from "../feature-flags";

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
