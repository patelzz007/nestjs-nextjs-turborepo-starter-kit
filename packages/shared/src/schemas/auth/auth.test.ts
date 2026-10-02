import { describe, expect, it } from "vitest";

import { epochMs } from "../api/common";

import { LoginClientResponseSchema, SessionListResponseSchema, type LoginClientResponse } from "./auth";
import { UserResponseSchema, type UserResponse } from "./user";

const EPOCH_ORIGIN_MS = 0;

const user: UserResponse = UserResponseSchema.parse({
	id: "user-1",
	email: "user@example.com",
	fullName: "Test User",
	isActive: true,
	isSuperAdmin: false,
	isEmailVerified: true,
	twoFactorEnabled: false,
	hasAdminAccess: false,
	tokenVersion: 0,
	roles: [],
	createdAt: epochMs(EPOCH_ORIGIN_MS),
	updatedAt: epochMs(EPOCH_ORIGIN_MS),
	isDeleted: false,
	deletedAt: null,
});

describe("LoginClientResponseSchema (every variant round-trips intact)", () => {
	it("keeps a full login success", () => {
		const payload: LoginClientResponse = { user };

		expect(LoginClientResponseSchema.parse(payload)).toEqual(payload);
	});

	it("keeps every field of a restricted-enrollment result that carries a user (not swallowed by the { user } variant)", () => {
		const payload: LoginClientResponse = {
			requiresEnrollment: true,
			enrollmentReason: "mfa_enrollment",
			message: "Complete MFA enrollment to continue.",
			user,
			organizationSlug: "acme-coffee",
		};

		expect(LoginClientResponseSchema.parse(payload)).toEqual(payload);
	});

	it("keeps a restricted-enrollment result without a user", () => {
		const payload: LoginClientResponse = { requiresEnrollment: true, enrollmentReason: "email_verification", message: "Verify your email." };

		expect(LoginClientResponseSchema.parse(payload)).toEqual(payload);
	});

	it("keeps a 2FA-pending result", () => {
		const payload: LoginClientResponse = { requiresTwoFactor: true, tempToken: "pending-token", message: "Enter your 2FA code." };

		expect(LoginClientResponseSchema.parse(payload)).toEqual(payload);
	});

	it("keeps a verification-pending result", () => {
		const payload: LoginClientResponse = { requiresVerification: true, verificationId: "verification-1", message: "Check your email." };

		expect(LoginClientResponseSchema.parse(payload)).toEqual(payload);
	});

	it("strips tokens that are still in the body (they belong in httpOnly cookies only)", () => {
		const parsed: LoginClientResponse = LoginClientResponseSchema.parse({ user, accessToken: "access-jwt", refreshToken: "refresh-jwt" });

		expect(parsed).toEqual({ user });
		expect(parsed).not.toHaveProperty("accessToken");
		expect(parsed).not.toHaveProperty("refreshToken");
	});

	it("strips tokens from a restricted-enrollment result and keeps the rest", () => {
		const parsed: LoginClientResponse = LoginClientResponseSchema.parse({
			requiresEnrollment: true,
			enrollmentReason: "mfa_enrollment",
			message: "Complete MFA enrollment to continue.",
			user,
			accessToken: "access-jwt",
			refreshToken: "refresh-jwt",
		});

		expect(parsed).toEqual({ requiresEnrollment: true, enrollmentReason: "mfa_enrollment", message: "Complete MFA enrollment to continue.", user });
	});

	it("rejects a payload that matches no variant", () => {
		expect(LoginClientResponseSchema.safeParse({ message: "nothing else" }).success).toBe(false);
	});
});

describe("SessionListResponseSchema", () => {
	it("parses a list of sessions and strips unknown keys", () => {
		const session = { id: "session-1", deviceInfo: null, ipAddress: "203.0.113.7", expiresAt: epochMs(EPOCH_ORIGIN_MS), createdAt: epochMs(EPOCH_ORIGIN_MS) };

		expect(SessionListResponseSchema.parse([{ ...session, tokenHash: "secret" }])).toEqual([session]);
	});
});
