import { describe, expect, it } from "vitest";

import { isAllowedWebPostLoginRedirect } from "@/contexts/identity/lib/routes";
import { ROUTES } from "@/lib/routes";

describe("isAllowedWebPostLoginRedirect", () => {
	it.each([ROUTES.home, ROUTES.dashboard.browse, ROUTES.dashboard.account, `${ROUTES.dashboard.browse}?category=cafe`, ROUTES.hello])(
		"sends a member back to %s",
		(redirect: string) => {
			expect(isAllowedWebPostLoginRedirect(redirect)).toBe(true);
		},
	);

	it.each([
		["another origin", "https://evil.example/dashboard"],
		["a protocol-relative URL", "//evil.example/dashboard"],
		["a backslash protocol-relative URL", "/\\evil.example/dashboard"],
		["a relative path", "dashboard/account"],
		["a guest page that needs no sign-in", "/rewards/abc"],
		["the login page itself", ROUTES.auth.login],
		["a prefix lookalike", "/dashboardx"],
	])("refuses %s", (_label: string, redirect: string) => {
		expect(isAllowedWebPostLoginRedirect(redirect)).toBe(false);
	});
});
