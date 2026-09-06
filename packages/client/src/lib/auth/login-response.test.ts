import {
	epochMs,
	LoginClientResponseSchema,
	LoginRestrictedEnrollmentClientResponseSchema,
	LoginResponseSchema,
	type LoginClientResponse,
	type LoginRestrictedEnrollmentClientResponse,
	UserResponseSchema,
} from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { isLoginRestrictedEnrollment, isLoginSuccess, isLoginTwoFactorPending, isLoginVerificationPending } from "./login-response";

const testUser = UserResponseSchema.parse({
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
	createdAt: epochMs(0),
	updatedAt: epochMs(0),
	isDeleted: false,
	deletedAt: null,
});

function restrictedEnrollmentResponse(enrollmentReason: LoginRestrictedEnrollmentClientResponse["enrollmentReason"], message: string): LoginClientResponse {
	return LoginRestrictedEnrollmentClientResponseSchema.parse({
		requiresEnrollment: true,
		enrollmentReason,
		message,
	});
}

describe("isLoginRestrictedEnrollment", () => {
	it("returns true for a restricted enrollment response", () => {
		const response = restrictedEnrollmentResponse("mfa_enrollment", "Complete MFA enrollment to continue.");

		expect(isLoginRestrictedEnrollment(response)).toBe(true);
	});

	it("returns false for a full login success response", () => {
		const response: LoginClientResponse = LoginResponseSchema.parse({ user: testUser });

		expect(isLoginRestrictedEnrollment(response)).toBe(false);
	});

	it("returns false for a 2FA pending response", () => {
		const response: LoginClientResponse = LoginClientResponseSchema.parse({
			requiresTwoFactor: true,
			tempToken: "pending-token",
			message: "Enter your 2FA code.",
		});

		expect(isLoginRestrictedEnrollment(response)).toBe(false);
		expect(isLoginTwoFactorPending(response)).toBe(true);
	});

	it("returns false for a login verification pending response", () => {
		const response: LoginClientResponse = LoginClientResponseSchema.parse({
			requiresVerification: true,
			verificationId: "verify-1",
			message: "Check your email.",
		});

		expect(isLoginRestrictedEnrollment(response)).toBe(false);
		expect(isLoginVerificationPending(response)).toBe(true);
	});

	it("returns false for malformed input", () => {
		expect(LoginClientResponseSchema.safeParse({ requiresEnrollment: "yes" }).success).toBe(false);
		expect(LoginClientResponseSchema.safeParse(null).success).toBe(false);
		expect(isLoginRestrictedEnrollment(LoginResponseSchema.parse({ user: testUser }))).toBe(false);
	});

	it("does not classify restricted enrollment as a plain login success", () => {
		const response = restrictedEnrollmentResponse("email_verification", "Verify your email to continue.");

		expect(isLoginRestrictedEnrollment(response)).toBe(true);
		expect(isLoginSuccess(response)).toBe(false);
	});
});
