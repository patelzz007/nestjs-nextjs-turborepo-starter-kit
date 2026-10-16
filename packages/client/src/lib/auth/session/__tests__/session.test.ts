import { describe, expect, it } from "vitest";

import { sessionPermissionsFixture, userFixture } from "../../../test/auth-fixtures";
import { composeAuthUser, isRestrictedAuthUser, PENDING_SESSION_SCOPE, resolveAuthEnrollmentReason, resolveSessionScope, type AuthUser } from "./session";

const testUser = userFixture({ email: "user@example.com", fullName: "Test User", isEmailVerified: false, tokenVersion: 0 });
const verifiedUser = userFixture({ isEmailVerified: true });

describe("resolveSessionScope", () => {
	it("reads a missing /auth/permissions answer as a PENDING scope — never as a full session (fail closed)", () => {
		expect(resolveSessionScope(undefined, false)).toEqual({ sessionScope: "pending", enrollmentReason: null });
		expect(resolveSessionScope(undefined, true)).toEqual({ sessionScope: "pending", enrollmentReason: null });
		expect(resolveSessionScope(undefined, true)).toBe(PENDING_SESSION_SCOPE);
	});

	it("reads a full answer as a full session", () => {
		expect(resolveSessionScope(sessionPermissionsFixture({ sessionScope: "full" }), false)).toEqual({ sessionScope: "full", enrollmentReason: null });
	});

	it("keeps the reason a restricted answer gives, and derives it from the verified flag otherwise", () => {
		expect(resolveSessionScope(sessionPermissionsFixture({ sessionScope: "restricted", enrollmentReason: "mfa_enrollment" }), false)).toEqual({
			sessionScope: "restricted",
			enrollmentReason: "mfa_enrollment",
		});
		expect(resolveSessionScope(sessionPermissionsFixture({ sessionScope: "restricted" }), false)).toEqual({
			sessionScope: "restricted",
			enrollmentReason: "email_verification",
		});
		expect(resolveSessionScope(sessionPermissionsFixture({ sessionScope: "restricted" }), true)).toEqual({ sessionScope: "restricted", enrollmentReason: "mfa_enrollment" });
	});

	it("drops a stray enrollment reason from a full session", () => {
		expect(resolveSessionScope(sessionPermissionsFixture({ sessionScope: "full", enrollmentReason: "mfa_enrollment" }), true)).toEqual({
			sessionScope: "full",
			enrollmentReason: null,
		});
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

	it("carries a pending scope through unchanged", () => {
		const user = composeAuthUser(testUser, PENDING_SESSION_SCOPE);

		expect(user.sessionScope).toBe("pending");
		expect(user.enrollmentReason).toBeNull();
	});
});

describe("isRestrictedAuthUser", () => {
	it("is false for nobody and for a full session", () => {
		expect(isRestrictedAuthUser(null)).toBe(false);
		expect(isRestrictedAuthUser(composeAuthUser(testUser, { sessionScope: "full", enrollmentReason: null }))).toBe(false);
	});

	it("is true for a restricted session", () => {
		expect(isRestrictedAuthUser(composeAuthUser(testUser, { sessionScope: "restricted", enrollmentReason: "email_verification" }))).toBe(true);
	});

	it("is true for a pending session — an unknown scope fails closed", () => {
		expect(isRestrictedAuthUser(composeAuthUser(testUser, PENDING_SESSION_SCOPE))).toBe(true);
	});
});

describe("resolveAuthEnrollmentReason", () => {
	it("returns the reason of a restricted session", () => {
		const user: AuthUser = composeAuthUser(
			testUser,
			resolveSessionScope(sessionPermissionsFixture({ sessionScope: "restricted", enrollmentReason: "email_verification" }), false),
		);

		expect(resolveAuthEnrollmentReason(user)).toBe("email_verification");
	});

	it("derives MFA enrollment for a restricted session whose email is already verified", () => {
		const user: AuthUser = composeAuthUser(verifiedUser, { sessionScope: "restricted", enrollmentReason: null });

		expect(resolveAuthEnrollmentReason(user)).toBe("mfa_enrollment");
	});

	it("derives email verification for a restricted session whose email is not verified", () => {
		const user: AuthUser = composeAuthUser(testUser, { sessionScope: "restricted", enrollmentReason: null });

		expect(resolveAuthEnrollmentReason(user)).toBe("email_verification");
	});

	it("returns null for a full session", () => {
		expect(resolveAuthEnrollmentReason(composeAuthUser(testUser, { sessionScope: "full", enrollmentReason: null }))).toBeNull();
	});

	it("returns null for a pending session — its reason is not known yet", () => {
		expect(resolveAuthEnrollmentReason(composeAuthUser(testUser, PENDING_SESSION_SCOPE))).toBeNull();
	});
});
