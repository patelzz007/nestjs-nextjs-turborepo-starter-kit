import { describe, expect, it } from "vitest";

import { isMerchantEnrollmentAllowedPath } from "@/contexts/identity/lib/enrollment";

describe("isMerchantEnrollmentAllowedPath", () => {
	it.each(["/account", "/account/security", "/t/acme/account", "/t/acme/account/sessions"])("keeps %s reachable during enrollment", (pathname: string): void => {
		expect(isMerchantEnrollmentAllowedPath(pathname)).toBe(true);
	});

	it.each(["/settings", "/t/acme/settings", "/t/acme/settings/team", "/t/acme/dashboard", "/accounts", "/t/acme/accounts", "/t/account", "/"])(
		"locks %s during enrollment",
		(pathname: string): void => {
			expect(isMerchantEnrollmentAllowedPath(pathname)).toBe(false);
		},
	);
});
