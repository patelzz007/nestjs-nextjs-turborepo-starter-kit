import { APP_LINKS } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	isTenantScopedPath,
	isPathWithin,
	TENANT_ROUTES,
	tenantPath,
	tenantRoot,
	tenantRoutes,
	resolveTenantHref,
	ROUTES,
	stripQueryAndHash,
	toAppPath,
	toTenantRelativePath,
} from "@/lib/routes";

const SLUG = "acme-coffee";
const REWARD_ID = "3f1c2b8e-9a4d-4c3e-8b7a-1d2e3f4a5b6c";

describe("ROUTES", () => {
	it("uses the shared APP_LINKS for paths the API builds into emails", () => {
		expect(ROUTES.onboarding).toBe(APP_LINKS.merchant.onboarding);
		expect(ROUTES.teamInvite).toBe(APP_LINKS.merchant.teamInvite);
		expect(ROUTES.auth.login).toBe(APP_LINKS.auth.login);
		expect(ROUTES.auth.verifyEmail).toBe(APP_LINKS.auth.verifyEmail);
		expect(tenantRoutes(SLUG).apiKeys).toBe(APP_LINKS.merchant.apiKeys(SLUG));
		expect(tenantRoutes(SLUG).terminals).toBe(APP_LINKS.merchant.terminals(SLUG));
	});

	it("keeps the tenant-relative API keys path in sync with the shared email link", () => {
		expect(tenantPath(SLUG, TENANT_ROUTES.apiKeys)).toBe(APP_LINKS.merchant.apiKeys(SLUG));
	});

	it("keeps the tenant-relative POS terminals path in sync with the shared app link", () => {
		expect(tenantPath(SLUG, TENANT_ROUTES.terminals)).toBe(APP_LINKS.merchant.terminals(SLUG));
	});

	it("separates the personal account from tenant settings", () => {
		expect(ROUTES.account).toBe("/account");
		expect(TENANT_ROUTES.account).toBe("/account");
		expect(TENANT_ROUTES.settings.index).toBe("/settings");
	});
});

describe("tenantRoutes", () => {
	it("builds tenant-scoped hrefs for every section", () => {
		const routes = tenantRoutes(SLUG);

		expect(routes.root).toBe("/t/acme-coffee");
		expect(routes.dashboard).toBe("/t/acme-coffee/dashboard");
		expect(routes.rewards.list).toBe("/t/acme-coffee/rewards");
		expect(routes.rewards.new).toBe("/t/acme-coffee/rewards/new");
		expect(routes.rewards.detail(REWARD_ID)).toBe(`/t/acme-coffee/rewards/${REWARD_ID}`);
		expect(routes.rewards.edit(REWARD_ID)).toBe(`/t/acme-coffee/rewards/${REWARD_ID}/edit`);
		expect(routes.redemptions).toBe("/t/acme-coffee/redemptions");
		expect(routes.analytics).toBe("/t/acme-coffee/analytics");
		expect(routes.terminals).toBe("/t/acme-coffee/terminals");
		expect(routes.apiKeys).toBe("/t/acme-coffee/api-keys");
		expect(routes.account).toBe("/t/acme-coffee/account");
		expect(routes.settings.index).toBe("/t/acme-coffee/settings");
		expect(routes.settings.team).toBe("/t/acme-coffee/settings/team");
		expect(routes.settings.locations).toBe("/t/acme-coffee/settings/locations");
		expect(routes.settings.branding).toBe("/t/acme-coffee/settings/branding");
		expect(routes.settings.verification).toBe("/t/acme-coffee/settings/verification");
	});

	it("maps the tenant-relative root to the tenant root without a trailing slash", () => {
		expect(tenantPath(SLUG, "/")).toBe("/t/acme-coffee");
	});

	it("encodes dynamic segments so an id cannot escape its segment", () => {
		expect(TENANT_ROUTES.rewards.detail("a/b?c")).toBe("/rewards/a%2Fb%3Fc");
		expect(TENANT_ROUTES.rewards.edit("a/b?c")).toBe("/rewards/a%2Fb%3Fc/edit");
		expect(tenantRoot("a/b")).toBe("/t/a%2Fb");
	});
});

describe("resolveTenantHref", () => {
	it("scopes tenant-relative routes to the active tenant", () => {
		expect(resolveTenantHref(SLUG, TENANT_ROUTES.rewards.list)).toBe("/t/acme-coffee/rewards");
	});

	it("falls back to the account entry page when the tenant is unknown", () => {
		expect(resolveTenantHref(undefined, TENANT_ROUTES.account)).toBe(ROUTES.account);
		expect(resolveTenantHref("", TENANT_ROUTES.account)).toBe(ROUTES.account);
	});

	it("falls back to the home entry page for every other route when the tenant is unknown", () => {
		expect(resolveTenantHref(undefined, TENANT_ROUTES.rewards.list)).toBe(ROUTES.home);
		expect(resolveTenantHref(undefined, TENANT_ROUTES.settings.team)).toBe(ROUTES.home);
	});
});

describe("path helpers", () => {
	it("matches prefixes segment by segment", () => {
		expect(isPathWithin("/settings", "/settings")).toBe(true);
		expect(isPathWithin("/settings/team", "/settings")).toBe(true);
		expect(isPathWithin("/settings-old", "/settings")).toBe(false);
		expect(isPathWithin("/accounts", "/account")).toBe(false);
	});

	it("treats `/` as an exact match only", () => {
		expect(isPathWithin("/", "/")).toBe(true);
		expect(isPathWithin("/rewards", "/")).toBe(false);
	});

	it("strips the query string and hash", () => {
		expect(stripQueryAndHash("/team-invite?token=abc")).toBe("/team-invite");
		expect(stripQueryAndHash("/t/acme#top")).toBe("/t/acme");
		expect(stripQueryAndHash("/t/acme")).toBe("/t/acme");
	});

	it("recognises tenant-scoped paths", () => {
		expect(isTenantScopedPath("/t/acme/rewards")).toBe(true);
		expect(isTenantScopedPath("/t")).toBe(false);
		expect(isTenantScopedPath("/tenants/acme")).toBe(false);
	});

	it("extracts the tenant-relative part of an tenant-scoped path", () => {
		expect(toTenantRelativePath("/t/acme/rewards/1/edit")).toBe("/rewards/1/edit");
		expect(toTenantRelativePath("/t/acme")).toBe("/");
		expect(toTenantRelativePath("/account")).toBeUndefined();
		expect(toTenantRelativePath("/t//account")).toBeUndefined();
	});

	it("accepts absolute paths and rejects relative ones", () => {
		expect(toAppPath("/auth/login")).toBe("/auth/login");
		expect(() => toAppPath("auth/login")).toThrow('Route "auth/login" must start with "/"');
	});
});
