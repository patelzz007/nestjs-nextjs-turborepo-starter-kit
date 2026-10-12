import { describe, expect, it } from "vitest";

import type { CompiledSidebarMenuData } from "./sidebar-menu-schema";
import { sidebarMenuSkeletonShape } from "./sidebar-menu-skeleton";

const MENU: CompiledSidebarMenuData = {
	header: { title: "Merchant", subtitle: "Portal" },
	sections: [
		{ title: "Overview", items: [{ id: "dashboard", title: "Dashboard", url: "/dashboard" }] },
		{
			title: "Rewards",
			items: [
				{ id: "rewards", title: "Rewards", url: "/rewards" },
				{ id: "redemptions", title: "Redemptions", url: "/redemptions" },
			],
		},
	],
	bottomItems: [
		{ id: "account", title: "Account", url: "/account" },
		{ id: "help", title: "Help", url: "/help" },
		{ id: "settings", title: "Settings", url: "/settings" },
	],
};

describe("sidebarMenuSkeletonShape", () => {
	it("counts each section's rows, in menu order", () => {
		expect(sidebarMenuSkeletonShape(MENU).sections).toStrictEqual([1, 2]);
	});

	it("counts the footer's rows", () => {
		expect(sidebarMenuSkeletonShape(MENU).footerRows).toBe(3);
	});
});
