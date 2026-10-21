import { createGrantedCapabilities, isCapabilityGranted } from "@workspace/client/lib/contexts/authorization/permission-check";
import { LIST_SLOT_INDEX, PERMISSION, type CapabilitySlug } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { MERCHANT_INVITES_FEATURE } from "@/lib/feature-flags";
import { filterCompiledSidebarMenu } from "@workspace/client/lib/navigation/filter-sidebar-menu-by-capabilities";
import { ADMIN_MENU_AUTHORIZATION, applyMenuAuthorization } from "@/lib/navigation/menu-authorization";
import { ADMIN_ROUTE_AUTHORIZATION, filterMenuByRouteAccess, type RouteAccessSession } from "@/lib/navigation/route-authorization";
import type { SidebarMenuData } from "@/lib/navigation/sidebar";
import { SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { buildSearchableItems } from "@/lib/palette/search";

/** A multi-tenant deployment: the API offers merchant invites, so only permissions decide what shows. */
const MULTI_TENANT_FLAGS: readonly string[] = [MERCHANT_INVITES_FEATURE];

function routeSession(capabilities: readonly CapabilitySlug[], isSuperAdmin: boolean, enabledFeatureFlags: readonly string[]): RouteAccessSession {
	const granted = createGrantedCapabilities(capabilities);
	return { isGranted: (permission: CapabilitySlug): boolean => isCapabilityGranted(granted, permission), enabledFeatureFlags, isSuperAdmin };
}

function visibleItems(
	capabilities: readonly CapabilitySlug[],
	isSuperAdmin: boolean,
	enabledFeatureFlags: readonly string[] = MULTI_TENANT_FLAGS,
): ReturnType<typeof buildSearchableItems> {
	return buildSearchableItems(
		filterMenuByRouteAccess(
			filterCompiledSidebarMenu(SIDEBAR_MENU, capabilities, { enabledFeatureFlags }),
			ADMIN_ROUTE_AUTHORIZATION,
			routeSession(capabilities, isSuperAdmin, enabledFeatureFlags),
		),
	);
}

function visibleUrls(capabilities: readonly CapabilitySlug[], isSuperAdmin = false, enabledFeatureFlags: readonly string[] = MULTI_TENANT_FLAGS): readonly string[] {
	return visibleItems(capabilities, isSuperAdmin, enabledFeatureFlags).map((item) => item.url);
}

function visibleTitles(capabilities: readonly CapabilitySlug[]): readonly string[] {
	return visibleItems(capabilities, false).map((item) => item.title);
}

describe("applyMenuAuthorization", () => {
	const menu: SidebarMenuData = {
		header: { title: "T", subtitle: "S" },
		sections: [
			{
				title: "Main",
				items: [
					{ title: "Geography", url: "/geography" },
					{ title: "Parent", url: "/p", children: [{ title: "Products", url: "/catalog/products" }] },
				],
			},
		],
		bottomItems: [{ title: "Help", url: "#" }],
	};

	it("attaches the mapped requirement by URL, including nested children", () => {
		const applied = applyMenuAuthorization(menu, ADMIN_MENU_AUTHORIZATION);
		const [geo, parent] = applied.sections[LIST_SLOT_INDEX.first]?.items ?? [];
		expect(geo?.authorization?.permissions).toEqual([PERMISSION.GEO.READ]);
		expect(parent?.authorization).toBeUndefined();
		expect(parent?.children?.[LIST_SLOT_INDEX.first]?.authorization?.permissions).toEqual([PERMISSION.PRODUCT.LIST]);
		expect(applied.bottomItems[LIST_SLOT_INDEX.first]?.authorization).toBeUndefined();
	});
});

describe("admin sidebar authorization", () => {
	it("hides permissioned pages from a session without capabilities", () => {
		const urls = visibleUrls([]);
		for (const url of [
			"/geography",
			"/emails/templates",
			"/emails/log",
			"/settings/access",
			"/catalog/products",
			"/catalog/categories",
			"/merchants",
			"/merchants/invites",
			"/merchants/verification",
			"/merchants/store-requests",
			"/rewards/review",
		]) {
			expect(urls).not.toContain(url);
		}
		// Structural section parents disappear when none of their children survive.
		for (const url of ["/emails", "/rewards", "/catalog"]) {
			expect(urls).not.toContain(url);
		}
		expect(visibleTitles([])).not.toContain("Review");
		expect(visibleTitles([PERMISSION.REWARD.MANAGE])).toContain("Review");
		expect(urls).toContain("/account/profile");
		expect(urls).toContain("/account/security");
	});

	it("shows each page once its API permission is granted (MANAGE implies LIST)", () => {
		const urls = visibleUrls([PERMISSION.GEO.READ, PERMISSION.EMAIL.LIST, PERMISSION.MERCHANT_ORG.MANAGE, PERMISSION.PRODUCT.LIST]);
		expect(urls).toContain("/geography");
		expect(urls).toContain("/emails/log");
		expect(urls).toContain("/merchants");
		expect(urls).toContain("/merchants/verification");
		expect(urls).toContain("/merchants/invites");
		expect(urls).toContain("/merchants/store-requests");
		expect(urls).toContain("/catalog/products");
		expect(urls).not.toContain("/catalog/categories");
		expect(urls).not.toContain("/emails/templates");
	});

	it("hides merchant invites on a single-tenant deployment, even with MANAGE", () => {
		const urls = visibleUrls([PERMISSION.MERCHANT_ORG.MANAGE], false, []);
		expect(urls).not.toContain("/merchants/invites");
		expect(urls).toContain("/merchants/verification");
	});

	it("keeps a structural section visible through one granted child", () => {
		const urls = visibleUrls([PERMISSION.EMAIL.LIST]);
		expect(urls).toContain("/emails");
		expect(urls).toContain("/emails/log");
		expect(urls).not.toContain("/emails/templates");
	});

	it("shows access control for any of its three permissions", () => {
		expect(visibleUrls([PERMISSION.PERMISSION.READ])).toContain("/settings/access");
		expect(visibleUrls([PERMISSION.ROLE.LIST])).toContain("/settings/access");
	});

	it("hides super-admin-only pages unless the session is a super admin", () => {
		expect(visibleUrls([PERMISSION.USER.MANAGE])).not.toContain("/users");
		expect(visibleUrls([PERMISSION.USER.MANAGE])).not.toContain("/users/mfa-recovery");
		expect(visibleUrls([], true)).toContain("/users");
		expect(visibleUrls([], true)).toContain("/users/mfa-recovery");
	});
});
