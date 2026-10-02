import { APP_LINKS } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { isOrgScopedPath, isPathWithin, ORG_ROUTES, orgPath, orgRoot, orgRoutes, resolveOrgHref, ROUTES, stripQueryAndHash, toAppPath, toOrgRelativePath } from "@/lib/routes";

const SLUG = "acme-coffee";
const REWARD_ID = "3f1c2b8e-9a4d-4c3e-8b7a-1d2e3f4a5b6c";

describe("ROUTES", () => {
	it("uses the shared APP_LINKS for paths the API builds into emails", () => {
		expect(ROUTES.onboarding).toBe(APP_LINKS.merchant.onboarding);
		expect(ROUTES.teamInvite).toBe(APP_LINKS.merchant.teamInvite);
		expect(ROUTES.auth.login).toBe(APP_LINKS.auth.login);
		expect(ROUTES.auth.verifyEmail).toBe(APP_LINKS.auth.verifyEmail);
		expect(orgRoutes(SLUG).apiKeys).toBe(APP_LINKS.merchant.apiKeys(SLUG));
		expect(orgRoutes(SLUG).terminals).toBe(APP_LINKS.merchant.terminals(SLUG));
	});

	it("keeps the org-relative API keys path in sync with the shared email link", () => {
		expect(orgPath(SLUG, ORG_ROUTES.apiKeys)).toBe(APP_LINKS.merchant.apiKeys(SLUG));
	});

	it("keeps the org-relative POS terminals path in sync with the shared app link", () => {
		expect(orgPath(SLUG, ORG_ROUTES.terminals)).toBe(APP_LINKS.merchant.terminals(SLUG));
	});

	it("separates the personal account from organization settings", () => {
		expect(ROUTES.account).toBe("/account");
		expect(ORG_ROUTES.account).toBe("/account");
		expect(ORG_ROUTES.settings.index).toBe("/settings");
	});
});

describe("orgRoutes", () => {
	it("builds org-scoped hrefs for every section", () => {
		const routes = orgRoutes(SLUG);

		expect(routes.root).toBe("/orgs/acme-coffee");
		expect(routes.dashboard).toBe("/orgs/acme-coffee/dashboard");
		expect(routes.rewards.list).toBe("/orgs/acme-coffee/rewards");
		expect(routes.rewards.new).toBe("/orgs/acme-coffee/rewards/new");
		expect(routes.rewards.edit(REWARD_ID)).toBe(`/orgs/acme-coffee/rewards/${REWARD_ID}/edit`);
		expect(routes.redemptions).toBe("/orgs/acme-coffee/redemptions");
		expect(routes.analytics).toBe("/orgs/acme-coffee/analytics");
		expect(routes.terminals).toBe("/orgs/acme-coffee/terminals");
		expect(routes.apiKeys).toBe("/orgs/acme-coffee/api-keys");
		expect(routes.account).toBe("/orgs/acme-coffee/account");
		expect(routes.settings.index).toBe("/orgs/acme-coffee/settings");
		expect(routes.settings.team).toBe("/orgs/acme-coffee/settings/team");
		expect(routes.settings.locations).toBe("/orgs/acme-coffee/settings/locations");
		expect(routes.settings.verification).toBe("/orgs/acme-coffee/settings/verification");
	});

	it("maps the org-relative root to the organization root without a trailing slash", () => {
		expect(orgPath(SLUG, "/")).toBe("/orgs/acme-coffee");
	});

	it("encodes dynamic segments so an id cannot escape its segment", () => {
		expect(ORG_ROUTES.rewards.edit("a/b?c")).toBe("/rewards/a%2Fb%3Fc/edit");
		expect(orgRoot("a/b")).toBe("/orgs/a%2Fb");
	});
});

describe("resolveOrgHref", () => {
	it("scopes org-relative routes to the active organization", () => {
		expect(resolveOrgHref(SLUG, ORG_ROUTES.rewards.list)).toBe("/orgs/acme-coffee/rewards");
	});

	it("falls back to the account entry page when the organization is unknown", () => {
		expect(resolveOrgHref(undefined, ORG_ROUTES.account)).toBe(ROUTES.account);
		expect(resolveOrgHref("", ORG_ROUTES.account)).toBe(ROUTES.account);
	});

	it("falls back to the home entry page for every other route when the organization is unknown", () => {
		expect(resolveOrgHref(undefined, ORG_ROUTES.rewards.list)).toBe(ROUTES.home);
		expect(resolveOrgHref(undefined, ORG_ROUTES.settings.team)).toBe(ROUTES.home);
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
		expect(stripQueryAndHash("/orgs/acme#top")).toBe("/orgs/acme");
		expect(stripQueryAndHash("/orgs/acme")).toBe("/orgs/acme");
	});

	it("recognises org-scoped paths", () => {
		expect(isOrgScopedPath("/orgs/acme/rewards")).toBe(true);
		expect(isOrgScopedPath("/orgs")).toBe(false);
		expect(isOrgScopedPath("/organizations/acme")).toBe(false);
	});

	it("extracts the org-relative part of an org-scoped path", () => {
		expect(toOrgRelativePath("/orgs/acme/rewards/1/edit")).toBe("/rewards/1/edit");
		expect(toOrgRelativePath("/orgs/acme")).toBe("/");
		expect(toOrgRelativePath("/account")).toBeUndefined();
		expect(toOrgRelativePath("/orgs//account")).toBeUndefined();
	});

	it("accepts absolute paths and rejects relative ones", () => {
		expect(toAppPath("/auth/login")).toBe("/auth/login");
		expect(() => toAppPath("auth/login")).toThrow('Route "auth/login" must start with "/"');
	});
});
