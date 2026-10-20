import { describe, expect, it } from "vitest";

import { getEnrollmentRedirectPath, isEnrollmentAllowedPath, isRestrictedSession } from "../restricted-session";

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
	it("sends the web app to its account page (inside the /dashboard shell)", () => {
		expect(getEnrollmentRedirectPath("web", "mfa_enrollment")).toBe("/dashboard/account");
	});

	it("sends merchant to the org-scoped account page when the tenant slug is known", () => {
		expect(getEnrollmentRedirectPath("merchant", "email_verification", "brew-bean-kl")).toBe("/t/brew-bean-kl/account");
	});

	it("sends merchant without a slug to /account, which resolves the tenant server-side", () => {
		expect(getEnrollmentRedirectPath("merchant", "email_verification")).toBe("/account");
	});

	it("sends admin to /account", () => {
		expect(getEnrollmentRedirectPath("admin", "mfa_enrollment")).toBe("/account");
	});
});

describe("isEnrollmentAllowedPath", () => {
	it("allows verify-email, login, and the personal account pages", () => {
		expect(isEnrollmentAllowedPath("/auth/verify-email")).toBe(true);
		expect(isEnrollmentAllowedPath("/auth/verify-email/token")).toBe(true);
		expect(isEnrollmentAllowedPath("/auth/login")).toBe(true);
		expect(isEnrollmentAllowedPath("/dashboard/account")).toBe(true);
		expect(isEnrollmentAllowedPath("/account")).toBe(true);
		expect(isEnrollmentAllowedPath("/account/security")).toBe(true);
	});

	it("allows the tenant-scoped merchant account page", () => {
		expect(isEnrollmentAllowedPath("/t/brew-bean-kl/account")).toBe(true);
		expect(isEnrollmentAllowedPath("/t/brew-bean-kl/account/security")).toBe(true);
	});

	it("blocks org / platform settings and protected app routes (only the personal account is reachable)", () => {
		expect(isEnrollmentAllowedPath("/t/brew-bean-kl/settings/team")).toBe(false);
		expect(isEnrollmentAllowedPath("/settings/access")).toBe(false);
		expect(isEnrollmentAllowedPath("/dashboard")).toBe(false);
		expect(isEnrollmentAllowedPath("/accounts")).toBe(false);
	});
});
