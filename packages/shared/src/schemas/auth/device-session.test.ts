import { describe, expect, it } from "vitest";

import { DEVICE_MODEL_HEADER, DEVICE_NAME_HEADER } from "../../contracts/client-session";
import { epochMs } from "../api/common";
import {
	encodeSessionDeviceHeaderValue,
	RevokeSessionInputSchema,
	RevokeSessionResponseSchema,
	SESSION_DEVICE_NAME_MAX_LENGTH,
	SessionDeviceModelHeaderSchema,
	SessionDeviceNameHeaderSchema,
	SessionDeviceNameSchema,
	sessionDisplayTextSchema,
	SessionListResponseSchema,
	SessionLocationSchema,
	SessionRevokedBySchema,
	SessionSignInMethodSchema,
	SessionSystemRevokerSchema,
	type Session,
} from "./device-session";

const SIGNED_IN_AT_MS = 1_790_000_000_000;
const SHORT_LIMIT = 5;
const USER_ID = "4b0a6f0e-8c1e-4d47-9a51-0d3f3f9b2c11";

const session: Session = {
	id: "8f6f2d55-1c0f-4c3e-9b8e-6a1f2b3c4d5e",
	label: "Alex’s iPhone",
	isCurrent: true,
	clientType: "mobile",
	browserName: "CFNetwork",
	browserVersion: null,
	osName: "iOS",
	osVersion: "26.0",
	deviceType: "MOBILE",
	deviceModel: "iPhone 15 Pro",
	deviceName: "Alex’s iPhone",
	appVersion: "1.4.0",
	signInMethod: "PASSWORD_TOTP_NEW_DEVICE_CODE",
	ipAddress: "203.0.113.24",
	lastIpAddress: "198.51.100.7",
	location: null,
	createdAt: epochMs(SIGNED_IN_AT_MS),
	lastActiveAt: epochMs(SIGNED_IN_AT_MS),
	expiresAt: epochMs(SIGNED_IN_AT_MS),
};

describe("device session headers", () => {
	it("names the two mobile device headers", () => {
		expect(DEVICE_MODEL_HEADER).toBe("X-Device-Model");
		expect(DEVICE_NAME_HEADER).toBe("X-Device-Name");
	});

	it("round-trips a Unicode device name through its percent-encoded header", () => {
		const name = "Alex’s 📱";
		expect(SessionDeviceNameHeaderSchema.parse(encodeSessionDeviceHeaderValue(name))).toBe(name);
	});

	it("decodes and trims a model header", () => {
		expect(SessionDeviceModelHeaderSchema.parse(encodeSessionDeviceHeaderValue("  Pixel 8 "))).toBe("Pixel 8");
	});

	it.each([
		["a broken percent-encoding", "%E0%A4%A"],
		["an empty value", ""],
		["only whitespace", "%20%20"],
		["a control character", encodeSessionDeviceHeaderValue("Alex\u0000Phone")],
		["a bidirectional override", encodeSessionDeviceHeaderValue("Alex‮enohP")],
		["a name over the column budget", encodeSessionDeviceHeaderValue("n".repeat(SESSION_DEVICE_NAME_MAX_LENGTH + 1))],
	])("rejects %s", (_case: string, value: string) => {
		expect(SessionDeviceNameHeaderSchema.safeParse(value).success).toBe(false);
	});

	it("rejects an encoded value longer than any valid name could encode to", () => {
		expect(SessionDeviceNameHeaderSchema.safeParse("%41".repeat(SESSION_DEVICE_NAME_MAX_LENGTH * 4 + 1)).success).toBe(false);
	});
});

describe("sessionDisplayTextSchema", () => {
	it("accepts text at the limit and rejects one character more", () => {
		const schema = sessionDisplayTextSchema(SHORT_LIMIT);
		expect(schema.parse("abcde")).toBe("abcde");
		expect(schema.safeParse("abcdef").success).toBe(false);
	});

	it("keeps emoji joiners (a device name may contain them)", () => {
		const family = "👨‍👩‍👧 iPad";
		expect(SessionDeviceNameSchema.parse(family)).toBe(family);
	});
});

describe("SessionSignInMethodSchema", () => {
	it("lists every sign-in flow, each with and without the new-device code", () => {
		expect(SessionSignInMethodSchema.options).toEqual([
			"PASSWORD",
			"PASSWORD_NEW_DEVICE_CODE",
			"PASSWORD_TOTP",
			"PASSWORD_TOTP_NEW_DEVICE_CODE",
			"PASSWORD_BACKUP_CODE",
			"PASSWORD_BACKUP_CODE_NEW_DEVICE_CODE",
			"TEAM_INVITE_REGISTRATION",
			"TEAM_INVITE_REGISTRATION_NEW_DEVICE_CODE",
		]);
	});
});

describe("SessionRevokedBySchema", () => {
	it("accepts a user id and every system marker", () => {
		expect(SessionRevokedBySchema.parse(USER_ID)).toBe(USER_ID);
		for (const marker of SessionSystemRevokerSchema.options) {
			expect(SessionRevokedBySchema.parse(marker)).toBe(marker);
		}
	});

	it("rejects a free-form marker", () => {
		expect(SessionRevokedBySchema.safeParse("system:because").success).toBe(false);
		expect(SessionRevokedBySchema.safeParse("admin").success).toBe(false);
	});
});

describe("SessionLocationSchema", () => {
	it("requires an ISO 3166-1 alpha-2 country", () => {
		expect(SessionLocationSchema.parse({ country: "MY", region: "Selangor", city: null })).toEqual({ country: "MY", region: "Selangor", city: null });
		expect(SessionLocationSchema.safeParse({ country: "my", region: null, city: null }).success).toBe(false);
		expect(SessionLocationSchema.safeParse({ country: "MYS", region: null, city: null }).success).toBe(false);
	});
});

describe("SessionListResponseSchema", () => {
	it("parses a list of sessions and strips unknown keys", () => {
		expect(SessionListResponseSchema.parse([{ ...session, token: "secret-hash" }])).toEqual([session]);
	});

	it("accepts the null details of a session stored before device details existed", () => {
		const legacy: Session = {
			...session,
			isCurrent: false,
			clientType: null,
			browserName: null,
			osName: null,
			osVersion: null,
			deviceType: null,
			deviceModel: null,
			deviceName: null,
			appVersion: null,
			signInMethod: null,
			lastIpAddress: null,
		};
		expect(SessionListResponseSchema.parse([legacy])).toEqual([legacy]);
	});
});

describe("revoke session contract", () => {
	it("takes one session id (a UUID) and nothing else", () => {
		expect(RevokeSessionInputSchema.parse({ sessionId: session.id })).toEqual({ sessionId: session.id });
		expect(RevokeSessionInputSchema.safeParse({ sessionId: "not-a-uuid" }).success).toBe(false);
		expect(RevokeSessionInputSchema.safeParse({ sessionId: session.id, userId: USER_ID }).success).toBe(false);
	});

	it("answers whether the caller's own session ended", () => {
		expect(RevokeSessionResponseSchema.parse({ message: "Session revoked", revokedCurrentSession: false })).toEqual({
			message: "Session revoked",
			revokedCurrentSession: false,
		});
	});
});
