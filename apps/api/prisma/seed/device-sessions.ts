import type { Prisma } from "@prisma/client";
import { encodeSessionDeviceHeaderValue, type AuthClientType, type SessionLocation, type SessionSignInMethod } from "@workspace/shared";

import { describeSessionDevice, type SessionDeviceDetails } from "../../src/modules/sessions/device/session-device";
import { sessionRevokerColumn, type SessionRevoker } from "../../src/modules/sessions/device/session-revoker";

// ---------------------------------------------------------------------------
// Device sessions (docs/technical/mobile/mobile-app.md §8) — the devices the
// demo users are signed in on, written through the API's own rules: the
// device details come from the same User-Agent parser and header validation a
// real sign-in uses (`describeSessionDevice`), so every seeded row is one the
// app could have stored. Every client type is represented (web, merchant,
// admin and the mobile app on iOS and Android).
// ---------------------------------------------------------------------------

/** What a device sends when it signs in. */
export interface SeedDeviceProfile {
	readonly clientType: AuthClientType;
	readonly userAgent: string;
	/** Mobile app only: `X-Device-Model`. */
	readonly deviceModel?: string;
	/** Mobile app only: `X-Device-Name`. */
	readonly deviceName?: string;
	/** Mobile app only: `X-App-Version`. */
	readonly appVersion?: string;
}

/** Real User-Agent strings of the clients the platform sees, one per client type and platform. */
export const SEED_DEVICE_PROFILES = {
	webChromeMac: {
		clientType: "web",
		userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.54 Safari/537.36",
	},
	webFirefoxLinux: { clientType: "web", userAgent: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0" },
	webSafariIphone: {
		clientType: "web",
		userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
	},
	merchantSafariMac: {
		clientType: "merchant",
		userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
	},
	merchantChromeTablet: {
		clientType: "merchant",
		userAgent: "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.54 Safari/537.36",
	},
	adminEdgeWindows: {
		clientType: "admin",
		userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.3537.57",
	},
	mobileIphone: {
		clientType: "mobile",
		userAgent: "RewardHub/42 CFNetwork/1568.100.1 Darwin/24.0.0",
		deviceModel: "iPhone 15 Pro",
		deviceName: "Alex’s iPhone",
		appVersion: "1.4.0",
	},
	mobilePixel: { clientType: "mobile", userAgent: "okhttp/4.12.0", deviceModel: "Pixel 8", deviceName: "Sam’s Pixel 8", appVersion: "1.3.2" },
} satisfies Record<string, SeedDeviceProfile>;

/** Browser profiles (web, merchant, admin) and mobile-app profiles, for picking one per seeded session. */
export const SEED_BROWSER_PROFILES: readonly SeedDeviceProfile[] = [
	SEED_DEVICE_PROFILES.webChromeMac,
	SEED_DEVICE_PROFILES.webFirefoxLinux,
	SEED_DEVICE_PROFILES.webSafariIphone,
	SEED_DEVICE_PROFILES.merchantSafariMac,
	SEED_DEVICE_PROFILES.merchantChromeTablet,
	SEED_DEVICE_PROFILES.adminEdgeWindows,
];

export const SEED_MOBILE_PROFILES: readonly SeedDeviceProfile[] = [SEED_DEVICE_PROFILES.mobileIphone, SEED_DEVICE_PROFILES.mobilePixel];

/**
 * Where seeded sessions signed in from — what a configured GeoIP provider
 * would store (`SessionLocationResolver`; the default `none` provider stores
 * nothing, so sessions created by the running app have no location).
 */
export const SEED_SESSION_LOCATIONS: readonly SessionLocation[] = [
	{ country: "MY", region: "Kuala Lumpur", city: "Kuala Lumpur" },
	{ country: "MY", region: "Selangor", city: "Petaling Jaya" },
	{ country: "SG", region: null, city: "Singapore" },
	{ country: "MY", region: "Melaka", city: null },
];

/** Every sign-in flow, for spreading the seeded sessions over all of them. */
export const SEED_SIGN_IN_METHODS: readonly SessionSignInMethod[] = [
	"PASSWORD",
	"PASSWORD_NEW_DEVICE_CODE",
	"PASSWORD_TOTP",
	"PASSWORD_TOTP_NEW_DEVICE_CODE",
	"PASSWORD_BACKUP_CODE",
	"PASSWORD_BACKUP_CODE_NEW_DEVICE_CODE",
	"TEAM_INVITE_REGISTRATION",
	"TEAM_INVITE_REGISTRATION_NEW_DEVICE_CODE",
];

/** The device details the API stores for a profile — through its own parser and header validation. */
export function seedDeviceDetails(profile: SeedDeviceProfile): SessionDeviceDetails {
	return describeSessionDevice({
		clientType: profile.clientType,
		userAgent: profile.userAgent,
		deviceModelHeader: profile.deviceModel === undefined ? undefined : encodeSessionDeviceHeaderValue(profile.deviceModel),
		deviceNameHeader: profile.deviceName === undefined ? undefined : encodeSessionDeviceHeaderValue(profile.deviceName),
		appVersionHeader: profile.appVersion,
	});
}

/** One seeded device session. */
export interface SeedSession {
	readonly id?: string;
	readonly userId: string;
	/** A hash — never a usable token. */
	readonly tokenHash: string;
	readonly previousTokenHash?: string;
	readonly rotationVersion?: number;
	readonly profile: SeedDeviceProfile;
	readonly signInMethod: SessionSignInMethod;
	readonly ipAddress: string;
	/** IP of the most recent refresh (equal to `ipAddress` for a session never refreshed). */
	readonly lastIpAddress: string;
	readonly location: SessionLocation | null;
	readonly createdAt: number;
	readonly lastActiveAt: number;
	readonly expiresAt: number;
	/** Set for a revoked session: when, and who revoked it (`deletedBy`). */
	readonly revoked?: { readonly at: number; readonly by: SessionRevoker };
}

/** The `refresh_tokens` row of a seeded session, every column filled as a real sign-in (and its refreshes) would. */
export function seedSessionRow(session: SeedSession): Prisma.RefreshTokenUncheckedCreateInput {
	const device: SessionDeviceDetails = seedDeviceDetails(session.profile);
	return {
		...(session.id === undefined ? {} : { id: session.id }),
		userId: session.userId,
		token: session.tokenHash,
		previousTokenHash: session.previousTokenHash ?? null,
		rotationVersion: session.rotationVersion ?? 0,
		clientType: device.clientType,
		browserName: device.browserName,
		browserVersion: device.browserVersion,
		osName: device.osName,
		osVersion: device.osVersion,
		deviceType: device.deviceType,
		deviceModel: device.deviceModel,
		deviceName: device.deviceName,
		appVersion: device.appVersion,
		signInMethod: session.signInMethod,
		ipAddress: session.ipAddress,
		lastIpAddress: session.lastIpAddress,
		lastActiveAt: session.lastActiveAt,
		locationCountry: session.location?.country ?? null,
		locationRegion: session.location?.region ?? null,
		locationCity: session.location?.city ?? null,
		expiresAt: session.expiresAt,
		isDeleted: session.revoked !== undefined,
		deletedAt: session.revoked?.at ?? null,
		deletedBy: session.revoked === undefined ? null : sessionRevokerColumn(session.revoked.by),
		createdAt: session.createdAt,
		updatedAt: session.revoked?.at ?? session.lastActiveAt,
	};
}
