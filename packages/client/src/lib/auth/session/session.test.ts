import { epochMs, UserResponseSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { composeAuthUser, isRestrictedAuthUser, mergeAuthSessionFields, resolveAuthEnrollmentReason, resolveSessionScope, toAuthUser } from "./session";

const testUser = UserResponseSchema.parse({
	id: "user-1",
	email: "user@example.com",
	fullName: "Test User",
	isActive: true,
	isSuperAdmin: false,
	isEmailVerified: false,
	twoFactorEnabled: false,
	hasAdminAccess: false,
	tokenVersion: 0,
	roles: [],
	createdAt: epochMs(0),
	updatedAt: epochMs(0),
	isDeleted: false,
	deletedAt: null,
});

describe("toAuthUser", () => {
	it("defaults to a full session when permissions are unavailable", () => {
		const user = toAuthUser(testUser);

		expect(user.sessionScope).toBe("full");
		expect(user.enrollmentReason).toBeNull();
	});

	it("maps restricted email verification sessions from permissions", () => {
		const user = toAuthUser(testUser, {
			sessionScope: "restricted",
			enrollmentReason: "email_verification",
		});

		expect(user.sessionScope).toBe("restricted");
		expect(user.enrollmentReason).toBe("email_verification");
		expect(isRestrictedAuthUser(user)).toBe(true);
	});

	it("derives MFA enrollment when email is already verified", () => {
		const verifiedUser = UserResponseSchema.parse({
			...testUser,
			isEmailVerified: true,
		});
		const user = toAuthUser(verifiedUser, { sessionScope: "restricted" });

		expect(resolveAuthEnrollmentReason(user)).toBe("mfa_enrollment");
	});
});

describe("mergeAuthSessionFields", () => {
	it("clears enrollment reason when the session becomes full", () => {
		const restricted = toAuthUser(testUser, { sessionScope: "restricted", enrollmentReason: "email_verification" });
		const full = mergeAuthSessionFields(restricted, { sessionScope: "full" });

		expect(full.sessionScope).toBe("full");
		expect(full.enrollmentReason).toBeNull();
	});
});

describe("resolveSessionScope", () => {
	it("reads a missing answer as a full session", () => {
		expect(resolveSessionScope(null, false)).toEqual({ sessionScope: "full", enrollmentReason: null });
		expect(resolveSessionScope(undefined, true)).toEqual({ sessionScope: "full", enrollmentReason: null });
	});

	it("keeps the reason a restricted answer gives, and derives it from the verified flag otherwise", () => {
		expect(resolveSessionScope({ sessionScope: "restricted", enrollmentReason: "mfa_enrollment" }, false)).toEqual({
			sessionScope: "restricted",
			enrollmentReason: "mfa_enrollment",
		});
		expect(resolveSessionScope({ sessionScope: "restricted" }, false)).toEqual({ sessionScope: "restricted", enrollmentReason: "email_verification" });
		expect(resolveSessionScope({ sessionScope: "restricted" }, true)).toEqual({ sessionScope: "restricted", enrollmentReason: "mfa_enrollment" });
	});

	it("drops a stray enrollment reason from a full session", () => {
		expect(resolveSessionScope({ sessionScope: "full", enrollmentReason: "mfa_enrollment" }, true)).toEqual({ sessionScope: "full", enrollmentReason: null });
	});
});

describe("composeAuthUser", () => {
	it("takes the profile fields from /auth/me and the scope from the session", () => {
		const user = composeAuthUser(testUser, { sessionScope: "restricted", enrollmentReason: "email_verification" });

		expect(user).toEqual({
			id: "user-1",
			email: "user@example.com",
			fullName: "Test User",
			isSuperAdmin: false,
			hasAdminAccess: false,
			isEmailVerified: false,
			sessionScope: "restricted",
			enrollmentReason: "email_verification",
			roles: [],
		});
	});
});
