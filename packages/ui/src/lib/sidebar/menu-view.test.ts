import { describe, expect, it } from "vitest";

import { buildSidebarView, computeRouteState, isRouteActive, type SidebarMenuItemLike } from "./menu-view";

/** Merchant-style branch: the parent shares its URL with its first child. */
const REWARDS_MENU: readonly SidebarMenuItemLike[] = [
	{
		id: "rewards-my-rewards",
		title: "My Rewards",
		url: "/orgs/jonker-street-kitchen/rewards",
		children: [
			{ id: "rewards-all-rewards", title: "All Rewards", url: "/orgs/jonker-street-kitchen/rewards" },
			{ id: "rewards-create-new", title: "Create New", url: "/orgs/jonker-street-kitchen/rewards/new" },
		],
	},
];

const NESTED_MENU: readonly SidebarMenuItemLike[] = [
	{
		id: "settings",
		title: "Settings",
		url: "/settings",
		children: [
			{ id: "settings-general", title: "General", url: "/settings/general" },
			{ id: "settings-security", title: "Security", url: "/settings/security" },
		],
	},
];

describe("isRouteActive", () => {
	it("matches the root exactly and nested routes below a parent", () => {
		expect(isRouteActive("/", "/")).toBe(true);
		expect(isRouteActive("/", "/users")).toBe(false);
		expect(isRouteActive("/settings", "/settings/general")).toBe(true);
		expect(isRouteActive("/organization", "/organizations")).toBe(false);
		expect(isRouteActive("#", "/")).toBe(false);
	});
});

describe("computeRouteState", () => {
	it("highlights only the child when a parent shares its URL (reported merchant bug)", () => {
		const { activeItems, autoExpandedItems } = computeRouteState(REWARDS_MENU, "/orgs/jonker-street-kitchen/rewards");

		expect(activeItems["rewards-all-rewards"]).toBe(true);
		// The parent/grandparent must NOT be highlighted alongside it…
		expect(activeItems["rewards-my-rewards"]).toBeUndefined();
		expect(activeItems["rewards-create-new"]).toBeUndefined();
		// …but the branch still auto-expands so the active leaf is reachable.
		expect(autoExpandedItems["rewards-my-rewards"]).toBe(true);
	});

	it("never highlights ancestors of the active page", () => {
		const { activeItems, autoExpandedItems } = computeRouteState(NESTED_MENU, "/settings/general");

		expect(activeItems["settings-general"]).toBe(true);
		expect(activeItems.settings).toBeUndefined();
		expect(autoExpandedItems.settings).toBe(true);
	});

	it("keeps the parent active only when no child matches the route", () => {
		const { activeItems } = computeRouteState(NESTED_MENU, "/settings/unmapped-detail");

		expect(activeItems.settings).toBe(true);
		expect(activeItems["settings-general"]).toBeUndefined();
	});

	it("lights the closest child (not the parent) on unmapped detail pages", () => {
		const { activeItems, autoExpandedItems } = computeRouteState(REWARDS_MENU, "/orgs/jonker-street-kitchen/rewards/abc123");

		// No entry points exactly at this URL → the single closest match wins:
		// the child "All Rewards" (same URL, deeper) beats its parent.
		expect(activeItems["rewards-all-rewards"]).toBe(true);
		expect(activeItems["rewards-my-rewards"]).toBeUndefined();
		expect(activeItems["rewards-create-new"]).toBeUndefined();
		expect(autoExpandedItems["rewards-my-rewards"]).toBe(true);
	});

	it("prefers the closest child over the parent on nested unmapped pages", () => {
		const { activeItems, autoExpandedItems } = computeRouteState(NESTED_MENU, "/settings/general/advanced");

		// "/settings/general" is a longer (closer) prefix than "/settings".
		expect(activeItems["settings-general"]).toBe(true);
		expect(activeItems.settings).toBeUndefined();
		expect(autoExpandedItems.settings).toBe(true);
	});

	it("lights exact-page aliases in other branches, but never their parents", () => {
		const menu: readonly SidebarMenuItemLike[] = [
			{ id: "dashboard", title: "Dashboard", url: "/rewardhub" },
			{ id: "discover", title: "Discover", url: "/rewardhub", children: [{ id: "browse-all", title: "Browse All", url: "/rewardhub" }] },
		];
		const { activeItems } = computeRouteState(menu, "/rewardhub");

		expect(activeItems.dashboard).toBe(true);
		expect(activeItems["browse-all"]).toBe(true);
		expect(activeItems.discover).toBeUndefined();
	});

	it("picks one global closest match on unmapped pages (shallow aliases stay dark)", () => {
		const menu: readonly SidebarMenuItemLike[] = [
			{ id: "dashboard", title: "Dashboard", url: "/rewardhub" },
			{ id: "my-wallet", title: "My Wallet", url: "/rewardhub/claims", children: [{ id: "active-rewards", title: "Active Rewards", url: "/rewardhub/claims" }] },
		];
		const { activeItems, autoExpandedItems } = computeRouteState(menu, "/rewardhub/claims/expired-otp");

		expect(activeItems["active-rewards"]).toBe(true);
		expect(activeItems["my-wallet"]).toBeUndefined();
		expect(activeItems.dashboard).toBeUndefined();
		expect(autoExpandedItems["my-wallet"]).toBe(true);
	});

	it("never highlights disabled items", () => {
		const menu: readonly SidebarMenuItemLike[] = [
			{ id: "docs", title: "Docs", url: "/docs", children: [{ id: "docs-alpha", title: "Alpha", url: "/docs/alpha", disabled: true }] },
		];
		const { activeItems, autoExpandedItems } = computeRouteState(menu, "/docs/alpha");

		expect(activeItems["docs-alpha"]).toBeUndefined();
		expect(autoExpandedItems.docs).toBeUndefined();
		expect(activeItems.docs).toBe(true);
	});
});

describe("buildSidebarView", () => {
	it("derives deepest-match route state from the full menu", () => {
		const view = buildSidebarView({
			menu: {
				sections: [{ title: "Rewards", items: REWARDS_MENU }],
				bottomItems: [],
			},
			pathname: "/orgs/jonker-street-kitchen/rewards",
			sectionOrder: null,
			searchQuery: "",
		});

		expect(view.routeState.activeItems["rewards-all-rewards"]).toBe(true);
		expect(view.routeState.activeItems["rewards-my-rewards"]).toBeUndefined();
		expect(view.noResults).toBe(false);
	});
});
