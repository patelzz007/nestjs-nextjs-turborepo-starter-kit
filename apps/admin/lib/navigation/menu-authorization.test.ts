import { PERMISSION, type CapabilitySlug } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { filterCompiledSidebarMenu } from "@/lib/navigation/filter-menu-by-capabilities";
import { ADMIN_MENU_AUTHORIZATION, applyMenuAuthorization } from "@/lib/navigation/menu-authorization";
import { ADMIN_ROUTE_AUTHORIZATION, filterSuperAdminOnlyMenu } from "@/lib/navigation/route-authorization";
import type { SidebarMenuData } from "@/lib/navigation/sidebar";
import { SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { buildSearchableItems } from "@/lib/palette/search";

function visibleItems(capabilities: readonly CapabilitySlug[], isSuperAdmin: boolean): ReturnType<typeof buildSearchableItems> {
	return buildSearchableItems(filterSuperAdminOnlyMenu(filterCompiledSidebarMenu(SIDEBAR_MENU, capabilities), ADMIN_ROUTE_AUTHORIZATION, isSuperAdmin));
}

function visibleUrls(capabilities: readonly CapabilitySlug[], isSuperAdmin = false): readonly string[] {
	return visibleItems(capabilities, isSuperAdmin).map((item) => item.url);
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
					{ title: "Geo", url: "/geo" },
					{ title: "Parent", url: "/p", children: [{ title: "Products", url: "/product" }] },
				],
			},
		],
		bottomItems: [{ title: "Help", url: "#" }],
	};

	it("attaches the mapped requirement by URL, including nested children", () => {
		const applied = applyMenuAuthorization(menu, ADMIN_MENU_AUTHORIZATION);
		const [geo, parent] = applied.sections[0]?.items ?? [];
		expect(geo?.authorization?.permissions).toEqual([PERMISSION.GEO.READ]);
		expect(parent?.authorization).toBeUndefined();
		expect(parent?.children?.[0]?.authorization?.permissions).toEqual([PERMISSION.PRODUCT.LIST]);
		expect(applied.bottomItems[0]?.authorization).toBeUndefined();
	});
});

describe("admin sidebar authorization", () => {
	it("hides permissioned pages from a session without capabilities", () => {
		const urls = visibleUrls([]);
		for (const url of ["/geo", "/emails", "/email-log", "/settings/access", "/product", "/sample-category", "/rewardhub/merchants", "/rewardhub/kyb", "/rewardhub/invites"]) {
			expect(urls).not.toContain(url);
		}
		// "/rewardhub/pending" is also the Reward Hub group's URL, so assert on the item title.
		expect(visibleTitles([])).not.toContain("Pending rewards");
		expect(visibleTitles([PERMISSION.REWARD.MANAGE])).toContain("Pending rewards");
		expect(urls).toContain("/settings/general");
	});

	it("shows each page once its API permission is granted (MANAGE implies LIST)", () => {
		const urls = visibleUrls([PERMISSION.GEO.READ, PERMISSION.EMAIL.LIST, PERMISSION.MERCHANT_ORG.MANAGE, PERMISSION.PRODUCT.LIST]);
		expect(urls).toContain("/geo");
		expect(urls).toContain("/email-log");
		expect(urls).toContain("/rewardhub/merchants");
		expect(urls).toContain("/rewardhub/kyb");
		expect(urls).toContain("/rewardhub/invites");
		expect(urls).toContain("/product");
		expect(urls).not.toContain("/emails");
	});

	it("shows access control for any of its three permissions", () => {
		expect(visibleUrls([PERMISSION.PERMISSION.READ])).toContain("/settings/access");
		expect(visibleUrls([PERMISSION.ROLE.LIST])).toContain("/settings/access");
	});

	it("hides super-admin-only pages unless the session is a super admin", () => {
		expect(visibleUrls([PERMISSION.USER.MANAGE])).not.toContain("/users/all");
		expect(visibleUrls([PERMISSION.MERCHANT_ORG.LIST])).not.toContain("/rewardhub/users");
		expect(visibleUrls([], true)).toContain("/users/all");
		expect(visibleUrls([PERMISSION.MERCHANT_ORG.LIST], true)).toContain("/rewardhub/users");
	});
});
