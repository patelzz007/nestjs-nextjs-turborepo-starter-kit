import { describe, expect, it } from "vitest";

import type { CompiledSidebarMenuItem } from "@/lib/navigation/sidebar";
import { flattenMenuItems, type SearchableMenuItem } from "@/lib/navigation/searchable-menu-items";

const ITEMS: readonly CompiledSidebarMenuItem[] = [
	{
		id: "settings",
		title: "Settings",
		url: "/settings",
		children: [
			{ id: "settings-billing", title: "Billing", url: "/settings/billing" },
			{ id: "settings-access", title: "Access control", url: "/settings/access" },
		],
	},
	{ id: "docs", title: "Docs", url: "/docs", children: [{ id: "docs-alpha", title: "Alpha", url: "/docs/alpha", disabled: true }] },
];

describe("flattenMenuItems", () => {
	it("flattens nested items with breadcrumbs and skips disabled ones", () => {
		const acc: SearchableMenuItem[] = [];
		flattenMenuItems(ITEMS, "Main", [], acc);
		expect(acc.map((entry) => entry.title)).toEqual(["Settings", "Billing", "Access control", "Docs"]);
		expect(acc[1]?.breadcrumb).toEqual(["Settings", "Billing"]);
	});

	it("tags every entry with its section and keeps the item's id and url", () => {
		const acc: SearchableMenuItem[] = [];
		flattenMenuItems(ITEMS, "Platform", [], acc);
		expect(acc.every((entry) => entry.section === "Platform")).toBe(true);
		expect(acc[2]).toMatchObject({ id: "settings-access", url: "/settings/access" });
	});

	it("prefixes the breadcrumb passed by the caller", () => {
		const acc: SearchableMenuItem[] = [];
		flattenMenuItems(ITEMS, "Main", ["Root"], acc);
		expect(acc[1]?.breadcrumb).toEqual(["Root", "Settings", "Billing"]);
	});
});
