/**
 * The admin sidebar uses the shared view model in
 * `@workspace/ui/lib/sidebar/menu-view` (active route, search, ordering). These
 * tests pin the behavior admin relies on, against admin's compiled menu shape.
 */
import { describe, expect, it } from "vitest";

import { buildSidebarView, computeRouteState, filterItemsBySearch, isRouteActive, sectionHasActiveItem } from "@workspace/ui/lib/sidebar/menu-view";
import { compileMenu } from "@/lib/navigation/sidebar-menu";
import type { CompiledSidebarMenuItem, SidebarMenuData } from "@/lib/navigation/sidebar";

const ITEMS: readonly CompiledSidebarMenuItem[] = [
	{
		id: "settings",
		title: "Settings",
		url: "/settings",
		children: [
			{ id: "settings-general", title: "General", url: "/settings/general" },
			{ id: "settings-security", title: "Security", url: "/settings/security" },
		],
	},
	{ id: "docs", title: "Docs", url: "/docs", children: [{ id: "docs-alpha", title: "Alpha", url: "/docs/alpha", disabled: true }] },
];

const RAW_MENU: SidebarMenuData = {
	header: { title: "Acme Inc.", subtitle: "Admin Panel" },
	sections: [
		{
			title: "Main",
			items: [
				{ title: "Security", url: "/main/security" },
				{ title: "Security", url: "/main/security-2" },
			],
		},
		{
			title: "Account",
			items: [{ title: "Security", url: "/account/security" }],
		},
	],
	bottomItems: [{ title: "Support", url: "/support" }],
};

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

describe("compileMenu (unique ids)", () => {
	it("prefixes root ids with the section and disambiguates same-titled siblings", () => {
		const compiled = compileMenu(RAW_MENU);
		const ids = compiled.sections.flatMap((section) => section.items.map((item) => item.id));
		// Two "Security" siblings under "Main": section-prefixed, second gets -2.
		expect(ids[0]).toBe("main-security");
		expect(ids[1]).toBe("main-security-2");
		// Same title in another section gets that section's prefix — no collision.
		expect(ids[2]).toBe("account-security");
	});

	it("produces globally unique ids across the whole tree", () => {
		const compiled = compileMenu(RAW_MENU);
		const ids: string[] = [];
		const collect = (items: readonly CompiledSidebarMenuItem[]): void => {
			for (const item of items) {
				ids.push(item.id);
				if (item.children !== undefined) {
					collect(item.children);
				}
			}
		};
		for (const section of compiled.sections) {
			collect(section.items);
		}
		collect(compiled.bottomItems);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe("computeRouteState", () => {
	it("marks only the matching page active, never its ancestors", () => {
		const { activeItems } = computeRouteState(ITEMS, "/settings/general");
		expect(activeItems["settings-general"]).toBe(true);
		// "/settings" is a route prefix of "/settings/general", but the parent
		// yields to its active child — parents/grandparents must not highlight.
		expect(activeItems.settings).toBeUndefined();
	});

	it("auto-expands ancestors of an active item", () => {
		const { autoExpandedItems } = computeRouteState(ITEMS, "/settings/general");
		expect(autoExpandedItems.settings).toBe(true);
	});

	it("keeps the parent active only when no child matches the route", () => {
		// Unmapped detail page under "/settings": no leaf matches exactly, so the
		// parent is the closest match and stays lit.
		const { activeItems } = computeRouteState(ITEMS, "/settings/unknown");
		expect(activeItems.settings).toBe(true);
		expect(activeItems["settings-general"]).toBeUndefined();
	});

	it("highlights only the child when a parent shares its URL", () => {
		// Merchant-style menu: "My Rewards" and "All Rewards" resolve to the same
		// page — only the leaf lights up, while the parent still auto-expands.
		const items: readonly CompiledSidebarMenuItem[] = [
			{
				id: "my-rewards",
				title: "My Rewards",
				url: "/orgs/jonker-street-kitchen/rewards",
				children: [
					{ id: "all-rewards", title: "All Rewards", url: "/orgs/jonker-street-kitchen/rewards" },
					{ id: "rewards-new", title: "Create New", url: "/orgs/jonker-street-kitchen/rewards/new" },
				],
			},
		];
		const { activeItems, autoExpandedItems } = computeRouteState(items, "/orgs/jonker-street-kitchen/rewards");
		expect(activeItems["all-rewards"]).toBe(true);
		expect(activeItems["my-rewards"]).toBeUndefined();
		expect(activeItems["rewards-new"]).toBeUndefined();
		expect(autoExpandedItems["my-rewards"]).toBe(true);
	});

	it("lights the closest child (not the parent) on unmapped detail pages", () => {
		const { activeItems, autoExpandedItems } = computeRouteState(ITEMS, "/settings/general/advanced");

		// No entry points exactly at this URL → the closest match wins: the child
		// "/settings/general" is a longer (closer) prefix than "/settings".
		expect(activeItems["settings-general"]).toBe(true);
		expect(activeItems.settings).toBeUndefined();
		expect(autoExpandedItems.settings).toBe(true);
	});

	it("skips disabled children when computing the active branch", () => {
		const { autoExpandedItems, activeItems } = computeRouteState(ITEMS, "/docs/alpha");
		expect(activeItems["docs-alpha"]).toBeUndefined();
		expect(autoExpandedItems.docs).toBeUndefined();
	});

	it("does not highlight a leaf whose URL is a prefix of the active sibling page", () => {
		const items: readonly CompiledSidebarMenuItem[] = [
			{
				id: "docs",
				title: "Docs",
				url: "/docs",
				children: [
					{ id: "docs-all", title: "View All Docs", url: "/docs" },
					{ id: "docs-settings", title: "Settings", url: "/docs/settings" },
				],
			},
		];
		const { activeItems } = computeRouteState(items, "/docs/settings");
		// The exact page is active…
		expect(activeItems["docs-settings"]).toBe(true);
		// …the route-prefix parent yields to it (no parent highlighting)…
		expect(activeItems.docs).toBeUndefined();
		// …and the shallower sibling leaf is not either (it only matches on /docs itself).
		expect(activeItems["docs-all"]).toBeUndefined();
	});

	it("still highlights a leaf on its own exact page even when it is a prefix of siblings", () => {
		const items: readonly CompiledSidebarMenuItem[] = [
			{
				id: "docs",
				title: "Docs",
				url: "/docs",
				children: [
					{ id: "docs-all", title: "View All Docs", url: "/docs" },
					{ id: "docs-settings", title: "Settings", url: "/docs/settings" },
				],
			},
		];
		const { activeItems } = computeRouteState(items, "/docs");
		expect(activeItems["docs-all"]).toBe(true);
		// The parent shares the child's URL and must not highlight alongside it.
		expect(activeItems.docs).toBeUndefined();
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

	it("matches URLs (audit #5)", () => {
		const result = filterItemsBySearch(ITEMS, "/docs/alpha");
		expect(result).toHaveLength(1);
		expect(result[0]?.title).toBe("Docs");
	});

	it("matches multiple tokens against the title path (audit #5)", () => {
		const result = filterItemsBySearch(ITEMS, "settings security");
		expect(result).toHaveLength(1);
		expect(result[0]?.children?.map((child) => child.title)).toEqual(["Security"]);
	});

	it("is case-insensitive", () => {
		const result = filterItemsBySearch(ITEMS, "SETTINGS");
		expect(result).toHaveLength(1);
	});

	it("never surfaces matches hidden under a disabled parent (audit #14)", () => {
		const items: readonly CompiledSidebarMenuItem[] = [
			{
				id: "analytics",
				title: "Analytics",
				url: "/analytics",
				disabled: true,
				children: [{ id: "analytics-sales", title: "Sales", url: "/analytics/sales", disabled: true }],
			},
			{ id: "docs", title: "Docs", url: "/docs", children: [{ id: "docs-alpha", title: "Alpha", url: "/docs/alpha", disabled: true }] },
		];
		// "Sales" only exists inside the disabled "Analytics" parent, whose children
		// are pruned at render — the match would be invisible, so it must not surface.
		expect(filterItemsBySearch(items, "sales")).toHaveLength(0);
		// A non-disabled parent still renders its disabled children, so its matches
		// ARE visible and must keep surfacing.
		expect(filterItemsBySearch(items, "alpha")).toHaveLength(1);
		// The disabled parent's own title still matches directly.
		expect(filterItemsBySearch(items, "analytics")).toHaveLength(1);
	});
});

describe("sectionHasActiveItem", () => {
	it("is true when an item (or descendant) is active", () => {
		const { activeItems } = computeRouteState(ITEMS, "/settings/security");
		expect(sectionHasActiveItem(ITEMS, activeItems)).toBe(true);
	});

	it("is false when nothing in the list is active", () => {
		expect(sectionHasActiveItem(ITEMS, {})).toBe(false);
	});
});

describe("buildSidebarView", () => {
	it("applies the persisted section order", () => {
		const menu = compileMenu(RAW_MENU);
		const ordered = buildSidebarView({
			menu,
			pathname: "/",
			sectionOrder: ["Account", "Main"],
			searchQuery: "",
		});
		expect(ordered.sections.map((section) => section.title)).toEqual(["Account", "Main"]);
	});

	it("falls back to the natural order when no stored order exists", () => {
		const menu = compileMenu(RAW_MENU);
		const natural = buildSidebarView({
			menu,
			pathname: "/",
			sectionOrder: null,
			searchQuery: "",
		});
		expect(natural.sections.map((section) => section.title)).toEqual(["Main", "Account"]);
	});

	it("reports noResults only while searching with zero matches", () => {
		const menu = compileMenu(RAW_MENU);
		const params = { menu, pathname: "/", sectionOrder: null };
		const empty = buildSidebarView({ ...params, searchQuery: "" });
		expect(empty.noResults).toBe(false);
		const miss = buildSidebarView({ ...params, searchQuery: "zzz-no-match" });
		expect(miss.noResults).toBe(true);
	});
});
