import { PERMISSION, type CapabilitySlug } from "@workspace/shared";
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

describe("resolveRouteAuthorization with dynamic segments", () => {
	const DYNAMIC_RULES: readonly RouteAuthorizationRule[] = [
		{ prefix: "/orders", authorization: { permissions: [PERMISSION.ORDER.LIST] } },
		{ prefix: "/orders/new", authorization: { permissions: [PERMISSION.ORDER.CREATE] } },
		{ prefix: "/orders/[id]", authorization: { permissions: [PERMISSION.ORDER.READ] } },
		{ prefix: "/orders/[id]/edit", authorization: { permissions: [PERMISSION.ORDER.UPDATE] } },
	];

	function dynamicPrefixFor(pathname: string): string | null {
		return resolveRouteAuthorization(DYNAMIC_RULES, pathname)?.prefix ?? null;
	}

	it("gives a resource's detail and edit pages their own rule", () => {
		expect(dynamicPrefixFor("/orders/42")).toBe("/orders/[id]");
		expect(dynamicPrefixFor("/orders/42/edit")).toBe("/orders/[id]/edit");
		expect(dynamicPrefixFor("/orders/42/history")).toBe("/orders/[id]");
	});

	it("prefers a literal segment over a dynamic one at the same depth", () => {
		expect(dynamicPrefixFor("/orders/new")).toBe("/orders/new");
	});
});

describe("buildRouteAuthorizationRules", () => {
	it("derives no rule from a disabled item, so it cannot shadow a gated ancestor", () => {
		const menu: SidebarMenuData = {
			header: { title: "T", subtitle: "S" },
			sections: [
				{
					title: "Main",
					items: [
						{
							title: "Orders",
							url: "/orders",
							authorization: { permissions: [PERMISSION.ORDER.LIST] },
							children: [{ title: "Archive", url: "/orders/archive", disabled: true }],
						},
					],
				},
			],
			bottomItems: [],
		};
		const rules = buildRouteAuthorizationRules(menu, []);
		expect(rules.map((rule) => rule.prefix)).toEqual(["/orders"]);
		expect(resolveRouteAuthorization(rules, "/orders/archive")?.authorization?.permissions).toEqual([PERMISSION.ORDER.LIST]);
	});

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
	function permissionsFor(pathname: string): readonly string[] | undefined {
		return resolveRouteAuthorization(ADMIN_ROUTE_AUTHORIZATION, pathname)?.authorization?.permissions;
	}

	it("marks user management and MFA recovery as super-admin only", () => {
		for (const pathname of ["/users", "/users/42", "/users/mfa-recovery"]) {
			expect(resolveRouteAuthorization(ADMIN_ROUTE_AUTHORIZATION, pathname)?.superAdminOnly, pathname).toBe(true);
		}
	});

	it("keeps the signed-in admin's personal account pages open", () => {
		for (const pathname of ["/account", "/account/profile", "/account/security"]) {
			const rule = resolveRouteAuthorization(ADMIN_ROUTE_AUTHORIZATION, pathname);
			expect(rule === null || isOpenRouteRule(rule), pathname).toBe(true);
		}
	});

	it("gates catalog pages by the permission of the API route they call", () => {
		// list → GET /product (LIST) · new → POST (CREATE) · detail → GET /:id (READ) · edit → PATCH /:id (UPDATE)
		expect(permissionsFor("/catalog/products")).toEqual([PERMISSION.PRODUCT.LIST]);
		expect(permissionsFor("/catalog/products/42")).toEqual([PERMISSION.PRODUCT.READ]);
		expect(permissionsFor("/catalog/products/42/edit")).toEqual([PERMISSION.PRODUCT.UPDATE]);
		expect(permissionsFor("/catalog/products/new")).toEqual([PERMISSION.PRODUCT.CREATE]);
		expect(permissionsFor("/catalog/categories")).toEqual([PERMISSION.SAMPLE_CATEGORY.LIST]);
		expect(permissionsFor("/catalog/categories/7")).toEqual([PERMISSION.SAMPLE_CATEGORY.READ]);
		expect(permissionsFor("/catalog/categories/7/edit")).toEqual([PERMISSION.SAMPLE_CATEGORY.UPDATE]);
		expect(permissionsFor("/catalog/categories/new")).toEqual([PERMISSION.SAMPLE_CATEGORY.CREATE]);
	});

	it("does not let a disabled (page-less) menu item open a hole under a gated section", () => {
		for (const pathname of ["/users/roles", "/users/roles/admins", "/users/api-keys"]) {
			expect(resolveRouteAuthorization(ADMIN_ROUTE_AUTHORIZATION, pathname)?.superAdminOnly, pathname).toBe(true);
		}
	});

	it("gates merchant, reward, email, and geography pages by the permission of the API route they call", () => {
		expect(permissionsFor("/merchants")).toEqual([PERMISSION.MERCHANT_ORG.LIST]);
		expect(permissionsFor("/merchants/invites")).toEqual([PERMISSION.MERCHANT_ORG.MANAGE]);
		expect(permissionsFor("/merchants/verification")).toEqual([PERMISSION.MERCHANT_ORG.LIST]);
		expect(permissionsFor("/merchants/store-requests")).toEqual([PERMISSION.MERCHANT_ORG.LIST]);
		expect(permissionsFor("/rewards/review")).toEqual([PERMISSION.REWARD.MANAGE]);
		expect(permissionsFor("/emails/templates")).toEqual([PERMISSION.EMAIL.READ]);
		expect(permissionsFor("/emails/log")).toEqual([PERMISSION.EMAIL.LIST]);
		expect(permissionsFor("/geography")).toEqual([PERMISSION.GEO.READ]);
		expect(permissionsFor("/settings/access")).toEqual([PERMISSION.ROLE.LIST, PERMISSION.PERMISSION.LIST, PERMISSION.PERMISSION.READ]);
	});

	it("opens access control with any one of its three views' permissions, so the page always has a tab to show", () => {
		const rule = resolveRouteAuthorization(ADMIN_ROUTE_AUTHORIZATION, "/settings/access");
		expect(rule?.authorization?.mode).toBe("any");
		for (const permission of [PERMISSION.ROLE.LIST, PERMISSION.PERMISSION.LIST, PERMISSION.PERMISSION.READ]) {
			expect(rule !== null && isRouteRuleSatisfied(rule, (granted) => granted === permission, []), permission).toBe(true);
		}
		expect(rule !== null && isRouteRuleSatisfied(rule, () => false, []), "no permission").toBe(false);
	});

	it("is the only check on the catalog detail/edit and reward review pages — they do not repeat it in-page", () => {
		// The pages render their content unconditionally behind the guard, so these rules alone deny access.
		const isDeniedWithOnly = (pathname: string, only: CapabilitySlug): boolean => {
			const rule = resolveRouteAuthorization(ADMIN_ROUTE_AUTHORIZATION, pathname);
			return rule !== null && !isRouteRuleSatisfied(rule, (granted) => granted === only, []);
		};
		expect(isDeniedWithOnly("/catalog/products/42", PERMISSION.PRODUCT.LIST)).toBe(true);
		expect(isDeniedWithOnly("/catalog/products/42/edit", PERMISSION.PRODUCT.READ)).toBe(true);
		expect(isDeniedWithOnly("/catalog/categories/7", PERMISSION.SAMPLE_CATEGORY.LIST)).toBe(true);
		expect(isDeniedWithOnly("/catalog/categories/7/edit", PERMISSION.SAMPLE_CATEGORY.READ)).toBe(true);
		expect(isDeniedWithOnly("/rewards/review", PERMISSION.REWARD.READ)).toBe(true);
	});

	it("matches rule prefixes on segment boundaries only", () => {
		expect(resolveRouteAuthorization(ADMIN_ROUTE_AUTHORIZATION, "/usersx")).toBeNull();
		expect(resolveRouteAuthorization(ADMIN_ROUTE_AUTHORIZATION, "/merchants-archive")).toBeNull();
	});
});
