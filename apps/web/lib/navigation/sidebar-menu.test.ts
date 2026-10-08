import { buildSidebarView } from "@workspace/ui/lib/sidebar/menu-view";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { filterCompiledSidebarMenu } from "@/lib/navigation/filter-menu-by-capabilities";
import { USER_SIDEBAR_MENU, type CompiledSidebarMenuItem } from "@/lib/navigation/sidebar-menu";
import { isPathWithin, rewardDetailPath, ROUTES, walletClaimPath } from "@/lib/routes";
import { listAppPageRoutes, resolvesToAppPage } from "@/test-support/app-routes";

interface MenuEntry {
	readonly item: CompiledSidebarMenuItem;
	readonly parent: CompiledSidebarMenuItem | null;
}

function flatten(items: readonly CompiledSidebarMenuItem[], parent: CompiledSidebarMenuItem | null, entries: MenuEntry[]): void {
	for (const item of items) {
		entries.push({ item, parent });
		flatten(item.children ?? [], item, entries);
	}
}

/** Every item in the real consumer menu — sections and bottom items — with its parent. */
function allMenuEntries(): readonly MenuEntry[] {
	const entries: MenuEntry[] = [];
	for (const section of USER_SIDEBAR_MENU.sections) {
		flatten(section.items, null, entries);
	}
	flatten(USER_SIDEBAR_MENU.bottomItems, null, entries);
	return entries;
}

const MENU_ENTRIES = allMenuEntries();
const ENABLED_ITEMS: readonly CompiledSidebarMenuItem[] = MENU_ENTRIES.map((entry) => entry.item).filter((item) => item.disabled !== true);

/** The one enabled menu item whose URL is `url`. */
function itemIdFor(url: string): string {
	const matches = ENABLED_ITEMS.filter((item) => item.url === url);
	expect(matches).toHaveLength(1);
	return matches[LIST_SLOT_INDEX.first]?.id ?? "";
}

/** Ids of the highlighted items for `pathname`, computed by the shared algorithm the sidebar panel renders with. */
function activeItemIds(pathname: string): readonly string[] {
	// No item in the consumer menu carries an authorization requirement, so a
	// signed-in member with no capabilities sees the whole menu — as in the panel.
	const menu = filterCompiledSidebarMenu(USER_SIDEBAR_MENU, []);
	const view = buildSidebarView({ menu, pathname, sectionOrder: null, searchQuery: "" });
	return Object.entries(view.routeState.activeItems)
		.filter(([, isActive]) => isActive)
		.map(([id]) => id);
}

describe("consumer sidebar menu (data/user-sidebar-menu.json)", () => {
	it("is not empty", () => {
		expect(ENABLED_ITEMS.length).toBeGreaterThan(0);
	});

	it("links every enabled item to an existing app/**/page.tsx", () => {
		const routes = listAppPageRoutes();
		const missing = ENABLED_ITEMS.filter((item) => !resolvesToAppPage(item.url, routes)).map((item) => `${item.title} → ${item.url}`);

		expect(missing).toEqual([]);
	});

	it("never gives two enabled items the same URL", () => {
		const urls = ENABLED_ITEMS.map((item) => item.url);
		const duplicates = urls.filter((url, index) => urls.indexOf(url) !== index);

		expect(duplicates).toEqual([]);
	});

	it("uses real paths everywhere — no '#' placeholders", () => {
		expect(MENU_ENTRIES.filter((entry) => !entry.item.url.startsWith("/")).map((entry) => entry.item.title)).toEqual([]);
	});

	it("nests every child under its parent's URL (segment-aware, never equal)", () => {
		const misplaced = MENU_ENTRIES.filter((entry) => entry.parent !== null)
			.filter((entry) => entry.parent === null || entry.item.url === entry.parent.url || !isPathWithin(entry.item.url, entry.parent.url))
			.map((entry) => `${entry.item.title} → ${entry.item.url}`);

		expect(misplaced).toEqual([]);
	});

	it("keeps every item inside the signed-in /rewardhub shell", () => {
		expect(MENU_ENTRIES.filter((entry) => !isPathWithin(entry.item.url, ROUTES.rewardHub.browse)).map((entry) => entry.item.url)).toEqual([]);
	});

	it("offers browse, wallet, activity and account as enabled links", () => {
		const urls = ENABLED_ITEMS.map((item) => item.url);

		expect(urls).toEqual(expect.arrayContaining([ROUTES.rewardHub.browse, ROUTES.rewardHub.wallet, ROUTES.rewardHub.activity, ROUTES.rewardHub.account]));
	});
});

describe("consumer sidebar active state (real menu + shared menu-view algorithm)", () => {
	it("highlights exactly one item — browse — on /rewardhub", () => {
		expect(activeItemIds(ROUTES.rewardHub.browse)).toEqual([itemIdFor(ROUTES.rewardHub.browse)]);
	});

	it("highlights browse on a signed-in reward detail page", () => {
		expect(activeItemIds(rewardDetailPath("abc"))).toEqual([itemIdFor(ROUTES.rewardHub.browse)]);
	});

	it("highlights the wallet on the wallet and on a claim's QR page", () => {
		expect(activeItemIds(ROUTES.rewardHub.wallet)).toEqual([itemIdFor(ROUTES.rewardHub.wallet)]);
		expect(activeItemIds(walletClaimPath("xyz"))).toEqual([itemIdFor(ROUTES.rewardHub.wallet)]);
	});

	it("highlights activity on /rewardhub/activity", () => {
		expect(activeItemIds(ROUTES.rewardHub.activity)).toEqual([itemIdFor(ROUTES.rewardHub.activity)]);
	});

	it("highlights Account — and not browse — on /rewardhub/account", () => {
		const active = activeItemIds(ROUTES.rewardHub.account);

		expect(active).toEqual([itemIdFor(ROUTES.rewardHub.account)]);
		expect(active).not.toContain(itemIdFor(ROUTES.rewardHub.browse));
	});

	it("highlights exactly one item on every enabled link's own page", () => {
		for (const item of ENABLED_ITEMS) {
			expect(activeItemIds(item.url)).toEqual([item.id]);
		}
	});
});
