import { describe, expect, it } from "vitest";

import { createMerchantNavHrefResolver } from "@/lib/navigation/resolve-nav-href";

describe("createMerchantNavHrefResolver", () => {
	const resolve = createMerchantNavHrefResolver("acme-coffee");

	it("scopes tenant-relative menu URLs to the tenant", () => {
		expect(resolve("/dashboard")).toBe("/t/acme-coffee/dashboard");
		expect(resolve("/rewards/new")).toBe("/t/acme-coffee/rewards/new");
		expect(resolve("/settings/team")).toBe("/t/acme-coffee/settings/team");
		expect(resolve("/account")).toBe("/t/acme-coffee/account");
	});

	it("is idempotent for already tenant-scoped hrefs", () => {
		expect(resolve(resolve("/redemptions"))).toBe("/t/acme-coffee/redemptions");
	});

	it("leaves placeholders and external links untouched", () => {
		expect(resolve("#")).toBe("#");
		expect(resolve("https://help.example.com")).toBe("https://help.example.com");
	});

	it("sends menu URLs to the server-side entry pages when no tenant is known", () => {
		const resolveWithoutTenant = createMerchantNavHrefResolver(undefined);

		expect(resolveWithoutTenant("/rewards")).toBe("/");
		expect(resolveWithoutTenant("/account")).toBe("/account");
	});
});
