import { describe, expect, it } from "vitest";

import { isAdminAuthPath, isAdminTokenAuthPath, isSafeAdminRedirect } from "@/lib/auth-routes";

describe("isAdminAuthPath", () => {
	it("matches every admin auth page", () => {
		for (const pathname of ["/auth/login", "/auth/forgot-password", "/auth/reset-password", "/auth/verify-email"]) {
			expect(isAdminAuthPath(pathname), pathname).toBe(true);
		}
	});

	it("is segment-aware and leaves panel pages alone", () => {
		expect(isAdminAuthPath("/auth/loginx")).toBe(false);
		expect(isAdminAuthPath("/account")).toBe(false);
		expect(isAdminAuthPath("/")).toBe(false);
	});
});

describe("isAdminTokenAuthPath", () => {
	it("is true only for emailed token links", () => {
		expect(isAdminTokenAuthPath("/auth/verify-email")).toBe(true);
		expect(isAdminTokenAuthPath("/auth/reset-password")).toBe(true);
		expect(isAdminTokenAuthPath("/auth/login")).toBe(false);
	});
});

describe("isSafeAdminRedirect", () => {
	it("accepts in-app panel paths", () => {
		expect(isSafeAdminRedirect("/")).toBe(true);
		expect(isSafeAdminRedirect("/merchants/verification?organizationId=org_1")).toBe(true);
		expect(isSafeAdminRedirect("/authors")).toBe(true);
	});

	it("rejects protocol-relative URLs, absolute URLs, and auth pages", () => {
		expect(isSafeAdminRedirect("//evil.com")).toBe(false);
		expect(isSafeAdminRedirect("https://evil.com")).toBe(false);
		expect(isSafeAdminRedirect("/auth/login")).toBe(false);
		expect(isSafeAdminRedirect("/auth")).toBe(false);
	});
});
