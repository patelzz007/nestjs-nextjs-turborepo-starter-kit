import { describe, expect, it } from "vitest";

import { isAllowedWebPostLoginRedirect } from "@/lib/auth/routes";
import { ROUTES } from "@/lib/routes";

describe("isAllowedWebPostLoginRedirect", () => {
	it.each([ROUTES.home, ROUTES.rewardHub.browse, ROUTES.rewardHub.account, `${ROUTES.rewardHub.browse}?category=cafe`, ROUTES.hello])(
		"sends a member back to %s",
		(redirect: string) => {
			expect(isAllowedWebPostLoginRedirect(redirect)).toBe(true);
		},
	);

	it.each([
		["another origin", "https://evil.example/rewardhub"],
		["a protocol-relative URL", "//evil.example/rewardhub"],
		["a backslash protocol-relative URL", "/\\evil.example/rewardhub"],
		["a relative path", "rewardhub/account"],
		["a guest page that needs no sign-in", "/rewards/abc"],
		["the login page itself", ROUTES.auth.login],
		["a prefix lookalike", "/rewardhubx"],
	])("refuses %s", (_label: string, redirect: string) => {
		expect(isAllowedWebPostLoginRedirect(redirect)).toBe(false);
	});
});
