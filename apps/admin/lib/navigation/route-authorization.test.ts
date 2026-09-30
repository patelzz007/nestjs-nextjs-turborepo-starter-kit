import { PERMISSION } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	ADMIN_ROUTE_AUTHORIZATION,
	buildRouteAuthorizationRules,
	isOpenRouteRule,
	isRouteRuleSatisfied,
	resolveRouteAuthorization,
	type RouteAuthorizationRule,
} from "@/lib/navigation/route-authorization";
import type { SidebarMenuData } from "@/lib/navigation/sidebar";

const MENU: SidebarMenuData = {
	header: { title: "T", subtitle: "S" },
	sections: [
		{
			title: "Main",
			items: [
				{ title: "Overview", url: "/" },
				{
					title: "Orders",
					url: "/orders",
					authorization: { permissions: [PERMISSION.ORDER.LIST] },
					children: [
						{ title: "Refunds", url: "/orders/refunds", authorization: { permissions: [PERMISSION.PAYMENT.UPDATE] } },
						{ title: "Open orders", url: "/orders/open" },
					],
				},
				{
					title: "Admin",
					url: "/admin",
					authorization: { permissions: [PERMISSION.ROLE.MANAGE], cascade: true },
					children: [{ title: "Roles", url: "/admin/roles" }],
				},
				{ title: "Beta", url: "/beta", featureFlag: "beta", children: [{ title: "Beta child", url: "/beta/child" }] },
			],
		},
	],
	bottomItems: [{ title: "Help", url: "#" }],
};

const RULES = buildRouteAuthorizationRules(MENU, [{ prefix: "/orders/export", authorization: { permissions: [PERMISSION.REPORT.CREATE] } }]);

function prefixFor(pathname: string): string | null {
	return resolveRouteAuthorization(RULES, pathname)?.prefix ?? null;
}

describe("resolveRouteAuthorization", () => {
	it("picks the longest matching prefix", () => {
		expect(prefixFor("/orders")).toBe("/orders");
		expect(prefixFor("/orders/123")).toBe("/orders");
		expect(prefixFor("/orders/refunds/9")).toBe("/orders/refunds");
		expect(prefixFor("/orders/export")).toBe("/orders/export");
	});

	it("matches on segment boundaries only", () => {
		expect(prefixFor("/ordersx")).toBeNull();
	});

	it("returns null for uncovered routes and ignores placeholder urls", () => {
		expect(prefixFor("/settings")).toBeNull();
		expect(RULES.some((rule) => rule.prefix === "#")).toBe(false);
	});
});

describe("buildRouteAuthorizationRules", () => {
	it("gives ungated children an open rule that shadows a non-cascading parent", () => {
		const rule = resolveRouteAuthorization(RULES, "/orders/open");
		expect(rule?.authorization).toBeUndefined();
	});

	it("propagates cascading requirements to descendant routes", () => {
		expect(resolveRouteAuthorization(RULES, "/admin/roles")?.authorization?.permissions).toEqual([PERMISSION.ROLE.MANAGE]);
	});

	it("propagates feature flags to descendant routes", () => {
		expect(resolveRouteAuthorization(RULES, "/beta/child")?.featureFlag).toBe("beta");
	});
});

describe("isRouteRuleSatisfied", () => {
	const orders: RouteAuthorizationRule = { prefix: "/orders", authorization: { permissions: [PERMISSION.ORDER.LIST] } };
	const flagged: RouteAuthorizationRule = { prefix: "/beta", featureFlag: "beta" };

	it("requires the permission", () => {
		expect(isRouteRuleSatisfied(orders, (permission) => permission === PERMISSION.ORDER.LIST, [])).toBe(true);
		expect(isRouteRuleSatisfied(orders, () => false, [])).toBe(false);
	});

	it("requires the feature flag", () => {
		expect(isRouteRuleSatisfied(flagged, () => true, [])).toBe(false);
		expect(isRouteRuleSatisfied(flagged, () => true, ["beta"])).toBe(true);
	});

	it("requires the super-admin flag for superAdminOnly rules and fails closed by default", () => {
		const superAdminRule: RouteAuthorizationRule = { prefix: "/users", superAdminOnly: true };
		expect(isRouteRuleSatisfied(superAdminRule, () => true, [])).toBe(false);
		expect(isRouteRuleSatisfied(superAdminRule, () => true, [], false)).toBe(false);
		expect(isRouteRuleSatisfied(superAdminRule, () => false, [], true)).toBe(true);
	});
});

describe("isOpenRouteRule", () => {
	it("treats only rules without any requirement as open", () => {
		expect(isOpenRouteRule({ prefix: "/open" })).toBe(true);
		expect(isOpenRouteRule({ prefix: "/users", superAdminOnly: true })).toBe(false);
		expect(isOpenRouteRule({ prefix: "/beta", featureFlag: "beta" })).toBe(false);
	});
});

describe("ADMIN_ROUTE_AUTHORIZATION", () => {
	it("marks user management and MFA recovery as super-admin only", () => {
		for (const pathname of ["/users/all", "/users/42", "/rewardhub/users", "/settings/security/mfa-recovery"]) {
			expect(resolveRouteAuthorization(ADMIN_ROUTE_AUTHORIZATION, pathname)?.superAdminOnly).toBe(true);
		}
		expect(resolveRouteAuthorization(ADMIN_ROUTE_AUTHORIZATION, "/settings/security")?.superAdminOnly).toBeUndefined();
	});

	it("gates pages by the permission of the API route they call", () => {
		expect(resolveRouteAuthorization(ADMIN_ROUTE_AUTHORIZATION, "/product/42")?.authorization?.permissions).toEqual([PERMISSION.PRODUCT.LIST]);
		expect(resolveRouteAuthorization(ADMIN_ROUTE_AUTHORIZATION, "/product/create")?.authorization?.permissions).toEqual([PERMISSION.PRODUCT.CREATE]);
		expect(resolveRouteAuthorization(ADMIN_ROUTE_AUTHORIZATION, "/rewardhub/pending")?.authorization?.permissions).toEqual([PERMISSION.REWARD.MANAGE]);
		expect(resolveRouteAuthorization(ADMIN_ROUTE_AUTHORIZATION, "/rewardhub/invites")?.authorization?.permissions).toEqual([PERMISSION.MERCHANT_ORG.MANAGE]);
		expect(resolveRouteAuthorization(ADMIN_ROUTE_AUTHORIZATION, "/admin/email-template")?.authorization?.permissions).toEqual([PERMISSION.EMAIL.READ]);
	});
});
