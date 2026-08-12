import { describe, expect, it } from "vitest";

import { buildSidebarView, computeRouteState, filterItemsBySearch, flattenMenuItems, isRouteActive, sectionHasActiveItem } from "@/lib/navigation/menu";
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

	it("does not highlight a leaf whose URL is a prefix of the active sibling page", () => {
		const items: readonly CompiledSidebarMenuItem[] = [
			{
				id: "docs",
				title: "Docs",
				url: "/docs",
				children: [
					{ id: "docs-all", title: "View All Docs", url: "/docs" },
					{ id: "docs-telescope", title: "Telescope", url: "/docs/telescope" },
				],
			},
		];
		const { activeItems } = computeRouteState(items, "/docs/telescope", false);
		// The exact page is active…
		expect(activeItems["docs-telescope"]).toBe(true);
		// …the route-prefix parent stays active…
		expect(activeItems.docs).toBe(true);
		// …but the shallower sibling leaf is not (it only matches on /docs itself).
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
					{ id: "docs-telescope", title: "Telescope", url: "/docs/telescope" },
				],
			},
		];
		const { activeItems } = computeRouteState(items, "/docs", false);
		expect(activeItems["docs-all"]).toBe(true);
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
		const { activeItems } = computeRouteState(ITEMS, "/settings/security", false);
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
			isHighlightParentItem: false,
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
			isHighlightParentItem: false,
		});
		expect(natural.sections.map((section) => section.title)).toEqual(["Main", "Account"]);
	});

	it("reports noResults only while searching with zero matches", () => {
		const menu = compileMenu(RAW_MENU);
		const params = { menu, pathname: "/", sectionOrder: null, isHighlightParentItem: false };
		const empty = buildSidebarView({ ...params, searchQuery: "" });
		expect(empty.noResults).toBe(false);
		const miss = buildSidebarView({ ...params, searchQuery: "zzz-no-match" });
		expect(miss.noResults).toBe(true);
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
