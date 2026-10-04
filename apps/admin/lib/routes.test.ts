import { APP_LINKS } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { isPathWithin, ROUTES } from "@/lib/routes";

describe("ROUTES", () => {
	it("takes the paths the API emails from APP_LINKS, so the app and the emails cannot drift", () => {
		expect(ROUTES.home).toBe(APP_LINKS.admin.home);
		expect(ROUTES.users.mfaRecovery).toBe(APP_LINKS.admin.mfaRecoveryQueue);
		expect(ROUTES.auth.login).toBe(APP_LINKS.auth.login);
		expect(ROUTES.auth.forgotPassword).toBe(APP_LINKS.auth.forgotPassword);
		expect(ROUTES.auth.resetPassword).toBe(APP_LINKS.auth.resetPassword);
		expect(ROUTES.auth.verifyEmail).toBe(APP_LINKS.auth.verifyEmail);
	});

	it("builds the CRUD shape for catalog resources", () => {
		expect(ROUTES.catalog.products.list).toBe("/catalog/products");
		expect(ROUTES.catalog.products.create).toBe("/catalog/products/new");
		expect(ROUTES.catalog.products.detail("42")).toBe("/catalog/products/42");
		expect(ROUTES.catalog.products.edit("42")).toBe("/catalog/products/42/edit");
		expect(ROUTES.catalog.categories.create).toBe("/catalog/categories/new");
		expect(ROUTES.catalog.categories.edit("7")).toBe("/catalog/categories/7/edit");
	});

	it("encodes dynamic path segments", () => {
		expect(ROUTES.users.detail("a/b c")).toBe("/users/a%2Fb%20c");
		expect(ROUTES.catalog.products.edit("x?y")).toBe("/catalog/products/x%3Fy/edit");
	});

	it("keeps in-page selection in an encoded query string", () => {
		expect(ROUTES.merchants.verificationFor("org_1")).toBe("/merchants/verification?organizationId=org_1");
		expect(ROUTES.merchants.verificationFor("a&b=c")).toBe("/merchants/verification?organizationId=a%26b%3Dc");
		expect(ROUTES.emails.template("merchant-invite")).toBe("/emails/templates?key=merchant-invite");
	});

	it("nests every section's pages under the section prefix", () => {
		expect(isPathWithin(ROUTES.analytics.sales, ROUTES.analytics.index)).toBe(true);
		expect(isPathWithin(ROUTES.merchants.storeRequests, ROUTES.merchants.list)).toBe(true);
		expect(isPathWithin(ROUTES.rewards.review, ROUTES.rewards.index)).toBe(true);
		expect(isPathWithin(ROUTES.emails.log, ROUTES.emails.index)).toBe(true);
		expect(isPathWithin(ROUTES.catalog.categories.list, ROUTES.catalog.index)).toBe(true);
		expect(isPathWithin(ROUTES.account.security, ROUTES.account.index)).toBe(true);
		expect(isPathWithin(ROUTES.users.mfaRecovery, ROUTES.users.list)).toBe(true);
	});
});

describe("isPathWithin", () => {
	it("matches the prefix itself and paths below it", () => {
		expect(isPathWithin("/merchants", "/merchants")).toBe(true);
		expect(isPathWithin("/merchants/invites", "/merchants")).toBe(true);
	});

	it("matches on segment boundaries only", () => {
		expect(isPathWithin("/merchantsx", "/merchants")).toBe(false);
		expect(isPathWithin("/auth/login-help", "/auth/login")).toBe(false);
	});

	it("treats the root as covering only itself", () => {
		expect(isPathWithin("/", "/")).toBe(true);
		expect(isPathWithin("/users", "/")).toBe(false);
	});
});
