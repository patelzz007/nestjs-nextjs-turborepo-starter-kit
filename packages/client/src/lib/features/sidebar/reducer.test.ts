import { describe, expect, it } from "vitest";

import { sidebarActions } from "./actions";
import { sidebarReducer } from "./reducer";
import { selectPreferences, resolveExpandedItems, selectManualExpansionFor } from "./selectors";
import { UNVERSIONED_STORAGE_FORMAT } from "../../state/feature-persistence";
import { INITIAL_SIDEBAR_STATE, MAX_MANUAL_EXPANDED_ITEMS, SidebarPreferencesSchema, type SidebarState } from "./state";
import { sidebarPersistence } from "./store";

const TITLES: readonly string[] = ["Rewards", "Wallet", "Insights"];

function state(overrides: Partial<SidebarState> = {}): SidebarState {
	return { ...INITIAL_SIDEBAR_STATE, ...overrides };
}

describe("sidebarReducer", () => {
	it("toggles, expands and collapses the rail", () => {
		const collapsed = sidebarReducer(state(), sidebarActions.toggled());
		expect(collapsed.isOpen).toBe(false);
		expect(sidebarReducer(collapsed, sidebarActions.toggled()).isOpen).toBe(true);
		expect(sidebarReducer(collapsed, sidebarActions.expanded()).isOpen).toBe(true);
		expect(sidebarReducer(state(), sidebarActions.collapsed()).isOpen).toBe(false);
	});

	it("moves sections within the menu's order, ignoring moves past either end", () => {
		const movedUp = sidebarReducer(state(), sidebarActions.sectionMoved("Wallet", -1, TITLES));
		expect(movedUp.sectionOrder).toEqual(["Wallet", "Rewards", "Insights"]);

		expect(sidebarReducer(movedUp, sidebarActions.sectionMoved("Insights", 1, TITLES)).sectionOrder).toEqual(["Wallet", "Rewards", "Insights"]);
		expect(sidebarReducer(state(), sidebarActions.sectionMoved("Unknown", 1, TITLES)).sectionOrder).toEqual(TITLES);
	});

	it("starts from the menu order again when the saved order no longer matches the menu", () => {
		const stale = state({ sectionOrder: ["Rewards", "Wallet"] });

		expect(sidebarReducer(stale, sidebarActions.sectionMoved("Insights", -1, TITLES)).sectionOrder).toEqual(["Rewards", "Insights", "Wallet"]);
	});

	it("records manual expand AND collapse choices for the page they were made on", () => {
		const expanded = sidebarReducer(state(), sidebarActions.itemExpansionChanged("/wallet", "wallet", true));
		expect(expanded.manualExpansion).toEqual({ pathname: "/wallet", items: { wallet: true } });

		// A collapse is a choice too (it overrides route auto-expansion), so it is kept, not deleted.
		expect(sidebarReducer(expanded, sidebarActions.itemExpansionChanged("/wallet", "wallet", false)).manualExpansion).toEqual({
			pathname: "/wallet",
			items: { wallet: false },
		});
	});

	it("replaces another page's choices instead of merging them", () => {
		const onWallet = sidebarReducer(state(), sidebarActions.itemExpansionChanged("/wallet", "wallet", true));

		expect(sidebarReducer(onWallet, sidebarActions.itemExpansionChanged("/rewards", "rewards", false)).manualExpansion).toEqual({
			pathname: "/rewards",
			items: { rewards: false },
		});
	});

	it("caps a page's choices at the NEWEST ones — the oldest toggles drop off first", () => {
		let current = state();
		const total = MAX_MANUAL_EXPANDED_ITEMS + 3;
		for (let index = 0; index < total; index += 1) {
			current = sidebarReducer(current, sidebarActions.itemExpansionChanged("/p", `item-${String(index)}`, true));
		}
		// 23 toggles under a cap of 20: the three oldest (0, 1, 2) are gone.
		expect(Object.keys(current.manualExpansion?.items ?? {}).at(0)).toBe("item-3");

		// Re-toggling an old item makes it the newest, so the NEXT drop takes item-3, not item-5.
		current = sidebarReducer(current, sidebarActions.itemExpansionChanged("/p", "item-5", false));
		current = sidebarReducer(current, sidebarActions.itemExpansionChanged("/p", "fresh", true));

		const kept = Object.keys(current.manualExpansion?.items ?? {});
		expect(kept).toHaveLength(MAX_MANUAL_EXPANDED_ITEMS);
		expect(kept.at(0)).toBe("item-4");
		expect(kept.slice(-2)).toEqual(["item-5", "fresh"]);
		expect(kept).not.toContain("item-3");
		expect(kept).toContain(`item-${String(total - 1)}`);
		expect(current.manualExpansion?.items["item-5"]).toBe(false);
	});

	it("sets and clears the search text", () => {
		const searching = sidebarReducer(state(), sidebarActions.searchChanged("wal"));
		expect(searching.searchQuery).toBe("wal");
		expect(sidebarReducer(searching, sidebarActions.searchCleared()).searchQuery).toBe("");
	});

	it("restores persisted preferences without touching the session-only search, capping stored choices to the newest", () => {
		const storedItems = Object.fromEntries(Array.from({ length: MAX_MANUAL_EXPANDED_ITEMS + 2 }, (_, index: number): [string, boolean] => [`item-${String(index)}`, true]));
		const restored = sidebarReducer(
			state({ searchQuery: "rew" }),
			sidebarActions.preferencesRestored({ isOpen: false, sectionOrder: ["Wallet", "Rewards", "Insights"], manualExpansion: { pathname: "/p", items: storedItems } }),
		);

		expect(restored.isOpen).toBe(false);
		expect(restored.sectionOrder).toEqual(["Wallet", "Rewards", "Insights"]);
		expect(restored.searchQuery).toBe("rew");
		expect(Object.keys(restored.manualExpansion?.items ?? {})).toEqual(Object.keys(storedItems).slice(2));
	});
});

describe("expanded items on a page", () => {
	const AUTO: Readonly<Record<string, boolean>> = { rewards: true };

	it("are the route's auto-expanded branches when the user made no choice on this page", () => {
		const elsewhere = sidebarReducer(state(), sidebarActions.itemExpansionChanged("/other", "wallet", true));

		expect(resolveExpandedItems(AUTO, selectManualExpansionFor(elsewhere, "/rewards"))).toEqual({ rewards: true });
	});

	it("let a manual collapse of the active branch win over auto-expansion on that page only", () => {
		const collapsed = sidebarReducer(state(), sidebarActions.itemExpansionChanged("/rewards", "rewards", false));

		expect(resolveExpandedItems(AUTO, selectManualExpansionFor(collapsed, "/rewards"))).toEqual({ rewards: false });
		expect(resolveExpandedItems(AUTO, selectManualExpansionFor(collapsed, "/rewards/other"))).toEqual({ rewards: true });
	});
});

describe("selectPreferences", () => {
	it("persists the rail, order and this page's choices — never the search text", () => {
		const current = sidebarReducer(state({ searchQuery: "secret" }), sidebarActions.itemExpansionChanged("/p", "wallet", true));

		const preferences = selectPreferences(current);

		expect(preferences).toEqual({ isOpen: true, sectionOrder: null, manualExpansion: { pathname: "/p", items: { wallet: true } } });
		expect(preferences).not.toHaveProperty("searchQuery");
	});
});

describe("SidebarPreferencesSchema", () => {
	it("rejects tampered values and the unversioned layouts (read only by the migration step)", () => {
		expect(SidebarPreferencesSchema.safeParse({ isOpen: "nope", sectionOrder: 42, manualExpansion: null }).success).toBe(false);
		expect(SidebarPreferencesSchema.safeParse({ state: { isOpen: false }, version: 0 }).success).toBe(false);
	});
});

describe("sidebarPersistence migrations", () => {
	const [unversioned] = sidebarPersistence("key").migrations;

	it("has exactly one step, from unversioned data", () => {
		expect(sidebarPersistence("key").migrations.map((step) => step.fromVersion)).toEqual([UNVERSIONED_STORAGE_FORMAT]);
	});

	it("upgrades the zustand/persist envelope, filling missing fields with defaults", () => {
		expect(unversioned?.upgrade(JSON.stringify({ state: { isOpen: false, sectionOrder: ["Docs", "Main"] }, version: 0 }))).toEqual({
			isOpen: false,
			sectionOrder: ["Docs", "Main"],
			manualExpansion: null,
		});
		expect(unversioned?.upgrade(JSON.stringify({ state: {}, version: 0 }))).toEqual({ isOpen: true, sectionOrder: null, manualExpansion: null });
	});

	it("upgrades the first feature store's snapshot, dropping its unscoped expanded branches", () => {
		expect(unversioned?.upgrade(JSON.stringify({ isOpen: false, sectionOrder: null, expandedItems: { wallet: true } }))).toEqual({
			isOpen: false,
			sectionOrder: null,
			manualExpansion: null,
		});
		expect(unversioned?.upgrade(JSON.stringify({ isOpen: "nope" }))).toBeNull();
	});
});
