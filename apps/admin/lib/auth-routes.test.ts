import { describe, expect, it } from "vitest";

import { isAdminAuthPath, isAdminTokenAuthPath, resolveAdminRedirectTarget, resolveSafeAdminRedirect } from "@/lib/auth-routes";

const ADMIN_ORIGIN = "http://localhost:3001";

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

describe("resolveSafeAdminRedirect", () => {
	it("accepts in-app panel paths and returns them normalized", () => {
		expect(resolveSafeAdminRedirect("/", ADMIN_ORIGIN)).toBe("/");
		expect(resolveSafeAdminRedirect("/merchants/verification?organizationId=org_1", ADMIN_ORIGIN)).toBe("/merchants/verification?organizationId=org_1");
		expect(resolveSafeAdminRedirect("/authors", ADMIN_ORIGIN)).toBe("/authors");
		expect(resolveSafeAdminRedirect("/users/./../merchants#top", ADMIN_ORIGIN)).toBe("/merchants#top");
	});

	it("rejects absolute and protocol-relative URLs", () => {
		expect(resolveSafeAdminRedirect("//evil.com", ADMIN_ORIGIN)).toBeNull();
		expect(resolveSafeAdminRedirect("https://evil.com", ADMIN_ORIGIN)).toBeNull();
		expect(resolveSafeAdminRedirect("http://localhost:3001/users", ADMIN_ORIGIN)).toBeNull();
		expect(resolveSafeAdminRedirect("javascript:alert(1)", ADMIN_ORIGIN)).toBeNull();
	});

	// Each vector below resolves to evil.com in a browser when passed through a
	// plain `startsWith("/") && !startsWith("//")` check.
	it("rejects a backslash, raw or percent-encoded", () => {
		expect(resolveSafeAdminRedirect("/\\evil.com", ADMIN_ORIGIN)).toBeNull();
		expect(resolveSafeAdminRedirect("/%5Cevil.com", ADMIN_ORIGIN)).toBeNull();
		expect(resolveSafeAdminRedirect("/%5cevil.com", ADMIN_ORIGIN)).toBeNull();
		expect(resolveSafeAdminRedirect("/\\/evil.com", ADMIN_ORIGIN)).toBeNull();
	});

	it("rejects control characters the URL parser strips, raw or percent-encoded", () => {
		expect(resolveSafeAdminRedirect("/\t/evil.com", ADMIN_ORIGIN)).toBeNull();
		expect(resolveSafeAdminRedirect("/%09/evil.com", ADMIN_ORIGIN)).toBeNull();
		expect(resolveSafeAdminRedirect("/\n/evil.com", ADMIN_ORIGIN)).toBeNull();
		expect(resolveSafeAdminRedirect("/%0D%0A/evil.com", ADMIN_ORIGIN)).toBeNull();
		expect(resolveSafeAdminRedirect("/%00", ADMIN_ORIGIN)).toBeNull();
	});

	it("rejects an encoded double slash and malformed percent-encoding", () => {
		expect(resolveSafeAdminRedirect("/%2F/evil.com", ADMIN_ORIGIN)).toBeNull();
		expect(resolveSafeAdminRedirect("/%E0%A4%A", ADMIN_ORIGIN)).toBeNull();
	});

	it("rejects the auth pages case-insensitively, including encoded spellings", () => {
		expect(resolveSafeAdminRedirect("/auth/login", ADMIN_ORIGIN)).toBeNull();
		expect(resolveSafeAdminRedirect("/auth", ADMIN_ORIGIN)).toBeNull();
		expect(resolveSafeAdminRedirect("/AUTH/login", ADMIN_ORIGIN)).toBeNull();
		expect(resolveSafeAdminRedirect("/Auth/Reset-Password", ADMIN_ORIGIN)).toBeNull();
		expect(resolveSafeAdminRedirect("/%61uth/login", ADMIN_ORIGIN)).toBeNull();
		expect(resolveSafeAdminRedirect("/users/../auth/login", ADMIN_ORIGIN)).toBeNull();
	});
});

describe("resolveAdminRedirectTarget", () => {
	it("falls back to the panel home for a missing or unsafe value", () => {
		expect(resolveAdminRedirectTarget(undefined, ADMIN_ORIGIN)).toBe("/");
		expect(resolveAdminRedirectTarget(null, ADMIN_ORIGIN)).toBe("/");
		expect(resolveAdminRedirectTarget("/%5Cevil.com", ADMIN_ORIGIN)).toBe("/");
	});

	it("passes a safe value through normalized", () => {
		expect(resolveAdminRedirectTarget("/users?page=2", ADMIN_ORIGIN)).toBe("/users?page=2");
	});
});
