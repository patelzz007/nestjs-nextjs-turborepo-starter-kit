import { describe, expect, it } from "vitest";

import { isMerchantEnrollmentAllowedPath } from "@/lib/auth/enrollment";

describe("isMerchantEnrollmentAllowedPath", () => {
	it.each(["/account", "/account/security", "/orgs/acme/account", "/orgs/acme/account/sessions"])("keeps %s reachable during enrollment", (pathname: string): void => {
		expect(isMerchantEnrollmentAllowedPath(pathname)).toBe(true);
	});

	it.each(["/settings", "/orgs/acme/settings", "/orgs/acme/settings/team", "/orgs/acme/dashboard", "/accounts", "/orgs/acme/accounts", "/orgs/account", "/"])(
		"locks %s during enrollment",
		(pathname: string): void => {
			expect(isMerchantEnrollmentAllowedPath(pathname)).toBe(false);
		},
	);
});
