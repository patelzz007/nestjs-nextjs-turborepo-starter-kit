// API payloads as the API sends them (plain JSON), valid against the shared
// response schemas — the api-client parses every one of them in the tests.

import type { DataValue } from "@workspace/shared";

import { FULL_ACCESS_TOKEN, REFRESH_TOKEN } from "./jwt";

export const NOW_MS = 1_791_504_000_000;

const HOUR_MS = 3_600_000;

interface UserOverrides {
	readonly twoFactorEnabled?: boolean;
	readonly fullName?: string;
	readonly isEmailVerified?: boolean;
}

export function userJson(overrides: UserOverrides = {}): DataValue {
	return {
		id: "user-1",
		email: "member@example.com",
		fullName: overrides.fullName ?? "Alex Morgan",
		isActive: true,
		isSuperAdmin: false,
		isEmailVerified: overrides.isEmailVerified ?? true,
		twoFactorEnabled: overrides.twoFactorEnabled ?? false,
		hasAdminAccess: false,
		tokenVersion: 1,
		roles: [],
		createdAt: 0,
		updatedAt: 0,
		isDeleted: false,
		deletedAt: null,
	};
}

/** `POST /auth/login` for client type mobile: the user plus the tokens in the body (ADR 029). */
export function mobileLoginJson(accessToken: string = FULL_ACCESS_TOKEN, refreshToken: string = REFRESH_TOKEN): DataValue {
	return { user: userJson(), tokenTransport: "body", accessToken, refreshToken };
}

export function profileJson(version = 3, fullName = "Alex Morgan"): DataValue {
	return { id: "6f1c3b8e-6a64-4b4e-9b7a-2f1f0a6f8d21", email: "member@example.com", fullName, avatar: null, version, createdAt: 0, updatedAt: 0 };
}

interface SessionJsonOverrides {
	readonly id: string;
	readonly label: string;
	readonly isCurrent?: boolean;
	readonly clientType?: "web" | "admin" | "merchant" | "mobile";
}

export function sessionJson(overrides: SessionJsonOverrides): DataValue {
	const isMobile = overrides.clientType === "mobile";
	return {
		id: overrides.id,
		label: overrides.label,
		isCurrent: overrides.isCurrent ?? false,
		clientType: overrides.clientType ?? "web",
		browserName: isMobile ? null : "Chrome",
		browserVersion: isMobile ? null : "141.0.0.0",
		osName: isMobile ? "iOS" : "macOS",
		osVersion: isMobile ? "26.0" : "16.1",
		deviceType: isMobile ? "MOBILE" : "DESKTOP",
		deviceModel: isMobile ? "iPhone 15 Pro" : null,
		deviceName: isMobile ? "Alex’s iPhone" : null,
		appVersion: isMobile ? "1.0.0" : null,
		signInMethod: "PASSWORD_TOTP",
		ipAddress: "203.0.113.24",
		lastIpAddress: "198.51.100.7",
		location: null,
		createdAt: NOW_MS - 2 * HOUR_MS,
		lastActiveAt: NOW_MS - HOUR_MS,
		expiresAt: NOW_MS + 24 * HOUR_MS,
	};
}

export function twoFactorSetupJson(): DataValue {
	return {
		secret: "JBSWY3DPEHPK3PXP",
		qrCodeDataUrl: "data:image/png;base64,iVBORw0KGgo=",
		otpAuthUrl: "otpauth://totp/Starter:member%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Starter",
		// Ten distinct codes from the backup-code alphabet (no 0/O, 1/I/L).
		backupCodes: ["S", "T", "U", "V", "W", "X", "Y", "Z", "2", "3"].map((last: string): string => `ABCDEFGHJKMNPQR${last}`),
	};
}
