import { describe, expect, it } from "vitest";

import { computeRouteState, createItemId, filterItemsBySearch, flattenMenuItems, isRouteActive } from "@/lib/menu";
import type { SidebarMenuItem } from "@/types/sidebar";

const ITEMS: readonly SidebarMenuItem[] = [
	{
		title: "Settings",
		url: "/settings",
		children: [
			{ title: "General", url: "/settings/general" },
			{ title: "Security", url: "/settings/security" },
		],
	},
	{ title: "Docs", url: "/docs", children: [{ title: "Alpha", url: "/docs/alpha", disabled: true }] },
];

describe("isRouteActive", () => {
	it("matches the root route exactly", () => {
		expect(isRouteActive("/", "/")).toBe(true);
		expect(isRouteActive("/", "/users")).toBe(false);
	});

	it("matches nested routes below a parent", () => {
		expect(isRouteActive("/settings", "/settings/general")).toBe(true);
		expect(isRouteActive("/settings/general", "/settings/general")).toBe(true);
	});

	it("does not match a sibling prefix", () => {
		expect(isRouteActive("/organization", "/organizations")).toBe(false);
	});

	it("treats # as never active", () => {
		expect(isRouteActive("#", "/")).toBe(false);
	});
});

describe("createItemId", () => {
	it("slugifies the title", () => {
		expect(createItemId({ title: "All Users", url: "/users/all" }, "")).toBe("all-users");
	});

	it("scopes the id under its parent", () => {
		expect(createItemId({ title: "General", url: "/settings/general" }, "settings")).toBe("settings-general");
	});
});

describe("computeRouteState", () => {
	it("marks the exact match active (and its route-prefix parents)", () => {
		const { activeItems } = computeRouteState(ITEMS, "/settings/general", false);
		expect(activeItems["settings-general"]).toBe(true);
		// "/settings" is a route prefix of "/settings/general", so it is active too.
		expect(activeItems.settings).toBe(true);
	});

	it("auto-expands ancestors of an active item", () => {
		const { autoExpandedItems } = computeRouteState(ITEMS, "/settings/general", false);
		expect(autoExpandedItems.settings).toBe(true);
	});

	it("highlights the root parent when requested", () => {
		const { activeItems } = computeRouteState(ITEMS, "/settings/general", true);
		expect(activeItems.settings).toBe(true);
	});

	it("skips disabled children when computing the active branch", () => {
		const { autoExpandedItems, activeItems } = computeRouteState(ITEMS, "/docs/alpha", false);
		expect(activeItems["docs-alpha"]).toBeUndefined();
		expect(autoExpandedItems.docs).toBeUndefined();
	});
});

describe("filterItemsBySearch", () => {
	it("returns everything for an empty query", () => {
		expect(filterItemsBySearch(ITEMS, "")).toHaveLength(2);
	});

	it("keeps parents that match and their subtrees", () => {
		const result = filterItemsBySearch(ITEMS, "settings");
		expect(result).toHaveLength(1);
		expect(result[0]?.title).toBe("Settings");
		expect(result[0]?.children).toHaveLength(2);
	});

	it("keeps parents whose children match, pruned to the match", () => {
		const result = filterItemsBySearch(ITEMS, "general");
		expect(result).toHaveLength(1);
		expect(result[0]?.children?.map((child) => child.title)).toEqual(["General"]);
	});
});
describe("flattenMenuItems", () => {
	it("flattens nested items with breadcrumbs and skips disabled ones", () => {
		const acc: { title: string; url: string; section: string; breadcrumb: readonly string[] }[] = [];
		flattenMenuItems(ITEMS, "Main", [], acc);
		expect(acc.map((entry) => entry.title)).toEqual(["Settings", "General", "Security", "Docs"]);
		expect(acc[1]?.breadcrumb).toEqual(["Settings", "General"]);
	});
});
