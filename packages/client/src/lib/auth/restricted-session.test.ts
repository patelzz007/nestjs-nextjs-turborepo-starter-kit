import { describe, expect, it } from "vitest";

import { ApiError } from "../api/use-api";
import { getEnrollmentRedirectPath, isEnrollmentAllowedPath, isRestrictedSession, isRestrictedSessionError } from "./restricted-session";

/** Build a JWT string from a payload (base64url header/payload, dummy signature). */
function makeJwt(payload: Record<string, string | number | boolean | undefined>): string {
	const encode = (value: Record<string, string | number | boolean | undefined>): string =>
		btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
	return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.signature`;
}

describe("isRestrictedSession", () => {
	it("returns true when sessionScope is restricted", () => {
		const token = makeJwt({ sub: "user-1", sessionScope: "restricted" });
		expect(isRestrictedSession(token)).toBe(true);
	});

	it("returns false for a full session", () => {
		const token = makeJwt({ sub: "user-1", sessionScope: "full" });
		expect(isRestrictedSession(token)).toBe(false);
	});

	it("returns false when sessionScope is omitted", () => {
		const token = makeJwt({ sub: "user-1" });
		expect(isRestrictedSession(token)).toBe(false);
	});

	it("returns false for malformed tokens", () => {
		expect(isRestrictedSession("not-a-jwt")).toBe(false);
	});
});

describe("getEnrollmentRedirectPath", () => {
	it("returns web settings for the web app", () => {
		expect(getEnrollmentRedirectPath("web", "mfa_enrollment")).toBe("/rewardhub/settings");
	});

	it("returns /settings for merchant and admin apps", () => {
		expect(getEnrollmentRedirectPath("merchant", "email_verification")).toBe("/settings");
		expect(getEnrollmentRedirectPath("admin", "mfa_enrollment")).toBe("/settings");
	});
});

describe("isEnrollmentAllowedPath", () => {
	it("allows verify-email, login, and settings routes", () => {
		expect(isEnrollmentAllowedPath("/auth/verify-email")).toBe(true);
		expect(isEnrollmentAllowedPath("/auth/verify-email/token")).toBe(true);
		expect(isEnrollmentAllowedPath("/auth/login")).toBe(true);
		expect(isEnrollmentAllowedPath("/rewardhub/settings")).toBe(true);
		expect(isEnrollmentAllowedPath("/settings/security")).toBe(true);
	});

	it("blocks protected dashboard routes", () => {
		expect(isEnrollmentAllowedPath("/rewardhub")).toBe(false);
		expect(isEnrollmentAllowedPath("/analytics")).toBe(false);
	});
});

describe("isRestrictedSessionError", () => {
	it("returns true for RESTRICTED_SESSION ApiError responses", () => {
		const error = new ApiError({
			message: "Complete email verification and MFA enrollment to access this resource.",
			error: "RESTRICTED_SESSION",
			statusCode: 403,
		});

		expect(isRestrictedSessionError(error)).toBe(true);
	});

	it("returns false for other API errors", () => {
		const error = new ApiError({
			message: "Invalid credentials",
			error: "INVALID_CREDENTIALS",
			statusCode: 401,
		});

		expect(isRestrictedSessionError(error)).toBe(false);
	});

	it("returns false for non-ApiError values", () => {
		expect(isRestrictedSessionError(new Error("boom"))).toBe(false);
		expect(isRestrictedSessionError("RESTRICTED_SESSION")).toBe(false);
	});
});
