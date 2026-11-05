import { describe, expect, it } from "vitest";

import type { CompiledSidebarMenuData } from "../sidebar-menu-schema";
import { sidebarMenuSkeletonShape } from "../sidebar-menu-skeleton";

const MENU: CompiledSidebarMenuData = {
	header: { title: "Merchant", subtitle: "Portal" },
	sections: [
		{ title: "Overview", key: "Overview", labelKey: "overview", items: [{ id: "dashboard", title: "Dashboard", labelKey: "dashboard", url: "/dashboard" }] },
		{
			title: "Rewards",
			key: "Rewards",
			labelKey: "rewards",
			items: [
				{ id: "rewards", title: "Rewards", labelKey: "rewards", url: "/rewards" },
				{ id: "redemptions", title: "Redemptions", labelKey: "redemptions", url: "/redemptions" },
			],
		},
	],
	bottomItems: [
		{ id: "account", title: "Account", labelKey: "account", url: "/account" },
		{ id: "help", title: "Help", labelKey: "help", url: "/help" },
		{ id: "settings", title: "Settings", labelKey: "settings", url: "/settings" },
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
