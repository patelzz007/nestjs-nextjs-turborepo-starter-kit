import { describe, expect, it } from "vitest";

import { isAllowedMerchantPostLoginRedirect, isMerchantAuthPath, isMerchantProtectedPath, isMerchantTokenAuthPath } from "@/contexts/identity/lib/routes";

describe("isMerchantProtectedPath", () => {
	it.each(["/", "/account", "/t/acme/dashboard", "/t/acme/account", "/t/acme/rewards/1/edit"])("protects %s", (pathname: string): void => {
		expect(isMerchantProtectedPath(pathname)).toBe(true);
	});

	it.each(["/auth/login", "/onboarding", "/team-invite", "/accounts", "/tenants", "/rewards", "/settings"])("does not protect %s", (pathname: string): void => {
		expect(isMerchantProtectedPath(pathname)).toBe(false);
	});
});

describe("isMerchantAuthPath", () => {
	it.each(["/auth/login", "/auth/verify-email", "/auth/verify-email/token-value", "/auth/forgot-password", "/auth/reset-password", "/onboarding", "/team-invite"])(
		"treats %s as an auth page",
		(pathname: string): void => {
			expect(isMerchantAuthPath(pathname)).toBe(true);
		},
	);

	it.each(["/auth/login-help", "/auth/reset-passwords", "/team-invites", "/t/acme/account"])("does not treat %s as an auth page", (pathname: string): void => {
		expect(isMerchantAuthPath(pathname)).toBe(false);
	});
});

describe("isMerchantTokenAuthPath", () => {
	it.each(["/auth/verify-email", "/auth/reset-password", "/onboarding", "/team-invite"])("treats %s as a one-shot token link", (pathname: string): void => {
		expect(isMerchantTokenAuthPath(pathname)).toBe(true);
	});

	it("does not exempt the login or forgot-password pages from the signed-in bounce", () => {
		expect(isMerchantTokenAuthPath("/auth/login")).toBe(false);
		expect(isMerchantTokenAuthPath("/auth/forgot-password")).toBe(false);
	});
});

describe("isAllowedMerchantPostLoginRedirect", () => {
	it.each(["/", "/account", "/t/acme/rewards", "/team-invite?token=abc"])("allows %s", (redirect: string): void => {
		expect(isAllowedMerchantPostLoginRedirect(redirect)).toBe(true);
	});

	it.each(["//evil.example", "/\\evil.example", "https://evil.example/t/acme", "/auth/login", "/rewards", "/team-invites"])("rejects %s", (redirect: string): void => {
		expect(isAllowedMerchantPostLoginRedirect(redirect)).toBe(false);
	});
});
