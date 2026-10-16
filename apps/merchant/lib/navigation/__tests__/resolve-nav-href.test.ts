import { describe, expect, it } from "vitest";

import { createMerchantNavHrefResolver } from "@/lib/navigation/resolve-nav-href";

describe("createMerchantNavHrefResolver", () => {
	const resolve = createMerchantNavHrefResolver("acme-coffee");

	it("scopes org-relative menu URLs to the organization", () => {
		expect(resolve("/dashboard")).toBe("/orgs/acme-coffee/dashboard");
		expect(resolve("/rewards/new")).toBe("/orgs/acme-coffee/rewards/new");
		expect(resolve("/settings/team")).toBe("/orgs/acme-coffee/settings/team");
		expect(resolve("/account")).toBe("/orgs/acme-coffee/account");
	});

	it("is idempotent for already org-scoped hrefs", () => {
		expect(resolve(resolve("/redemptions"))).toBe("/orgs/acme-coffee/redemptions");
	});

	it("leaves placeholders and external links untouched", () => {
		expect(resolve("#")).toBe("#");
		expect(resolve("https://help.example.com")).toBe("https://help.example.com");
	});

	it("sends menu URLs to the server-side entry pages when no organization is known", () => {
		const resolveWithoutOrg = createMerchantNavHrefResolver(undefined);

		expect(resolveWithoutOrg("/rewards")).toBe("/");
		expect(resolveWithoutOrg("/account")).toBe("/account");
	});
});
