import { AuthClientTypeSchema, SessionRevokedBySchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { revokedBySystem } from "../../src/modules/sessions/device/session-revoker";
import {
	SEED_BROWSER_PROFILES,
	SEED_DEVICE_PROFILES,
	SEED_MOBILE_PROFILES,
	SEED_SESSION_LOCATIONS,
	seedDeviceDetails,
	seedSessionRow,
	type SeedSession,
} from "./device-sessions";

const SIGNED_IN_AT_MS = 1_790_000_000_000;
const HOUR_MS = 3_600_000;

const PHONE_SESSION: SeedSession = {
	userId: "user-1",
	tokenHash: "hash",
	profile: SEED_DEVICE_PROFILES.mobileIphone,
	signInMethod: "PASSWORD_TOTP_NEW_DEVICE_CODE",
	ipAddress: "198.51.100.73",
	lastIpAddress: "203.0.113.41",
	location: { country: "MY", region: "Selangor", city: "Petaling Jaya" },
	createdAt: SIGNED_IN_AT_MS,
	lastActiveAt: SIGNED_IN_AT_MS + HOUR_MS,
	expiresAt: SIGNED_IN_AT_MS + 7 * 24 * HOUR_MS,
};

describe("seeded device profiles", () => {
	it("cover every client type (web, merchant, admin and the mobile app)", () => {
		const clientTypes = new Set([...SEED_BROWSER_PROFILES, ...SEED_MOBILE_PROFILES].map((profile) => profile.clientType));

		expect([...clientTypes].sort()).toEqual([...AuthClientTypeSchema.options].sort());
	});

	it("describe a browser through the API's own User-Agent parser", () => {
		expect(seedDeviceDetails(SEED_DEVICE_PROFILES.webChromeMac)).toMatchObject({ clientType: "web", browserName: "Chrome", osName: "macOS", deviceType: "DESKTOP" });
		expect(seedDeviceDetails(SEED_DEVICE_PROFILES.merchantChromeTablet)).toMatchObject({ deviceType: "TABLET", deviceModel: "SM-X710" });
	});

	it("give every mobile profile a model, a name and an app version that pass the API's header validation", () => {
		for (const profile of SEED_MOBILE_PROFILES) {
			expect(seedDeviceDetails(profile)).toMatchObject({
				clientType: "mobile",
				deviceModel: profile.deviceModel,
				deviceName: profile.deviceName,
				appVersion: profile.appVersion,
			});
		}
	});

	it("include locations with and without a region and a city", () => {
		expect(SEED_SESSION_LOCATIONS.some((location) => location.region === null)).toBe(true);
		expect(SEED_SESSION_LOCATIONS.some((location) => location.city === null)).toBe(true);
		expect(SEED_SESSION_LOCATIONS.some((location) => location.region !== null && location.city !== null)).toBe(true);
	});
});

describe("seedSessionRow", () => {
	it("fills every device-session column of a live session", () => {
		expect(seedSessionRow(PHONE_SESSION)).toEqual({
			userId: "user-1",
			token: "hash",
			previousTokenHash: null,
			rotationVersion: 0,
			clientType: "mobile",
			browserName: "CFNetwork",
			browserVersion: null,
			osName: "iOS",
			osVersion: null,
			deviceType: "MOBILE",
			deviceModel: "iPhone 15 Pro",
			deviceName: "Alex’s iPhone",
			appVersion: "1.4.0",
			signInMethod: "PASSWORD_TOTP_NEW_DEVICE_CODE",
			ipAddress: "198.51.100.73",
			lastIpAddress: "203.0.113.41",
			lastActiveAt: SIGNED_IN_AT_MS + HOUR_MS,
			locationCountry: "MY",
			locationRegion: "Selangor",
			locationCity: "Petaling Jaya",
			expiresAt: SIGNED_IN_AT_MS + 7 * 24 * HOUR_MS,
			isDeleted: false,
			deletedAt: null,
			deletedBy: null,
			createdAt: SIGNED_IN_AT_MS,
			updatedAt: SIGNED_IN_AT_MS + HOUR_MS,
		});
	});

	it("soft-deletes a revoked session with a deletedBy the shared schema accepts", () => {
		const row = seedSessionRow({ ...PHONE_SESSION, revoked: { at: SIGNED_IN_AT_MS + 2 * HOUR_MS, by: revokedBySystem("system:rotation-reuse") } });

		expect(row).toMatchObject({ isDeleted: true, deletedAt: SIGNED_IN_AT_MS + 2 * HOUR_MS, deletedBy: "system:rotation-reuse", updatedAt: SIGNED_IN_AT_MS + 2 * HOUR_MS });
		expect(SessionRevokedBySchema.safeParse(row.deletedBy).success).toBe(true);
	});
});
