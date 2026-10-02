import { describe, expect, it } from "vitest";

import { sidebarActions } from "./actions";
import { sidebarReducer } from "./reducer";
import { selectPreferences } from "./selectors";
import { INITIAL_SIDEBAR_STATE, MAX_PERSISTED_EXPANDED_ITEMS, SidebarPreferencesSchema, type SidebarState } from "./state";

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

	it("expands and collapses nav branches and resets them", () => {
		const expanded = sidebarReducer(state(), sidebarActions.itemExpansionChanged("wallet", true));
		expect(expanded.expandedItems).toEqual({ wallet: true });

		expect(sidebarReducer(expanded, sidebarActions.itemExpansionChanged("wallet", false)).expandedItems).toEqual({});
		expect(sidebarReducer(expanded, sidebarActions.expandedItemsReset()).expandedItems).toEqual({});
	});

	it("sets and clears the search text", () => {
		const searching = sidebarReducer(state(), sidebarActions.searchChanged("wal"));
		expect(searching.searchQuery).toBe("wal");
		expect(sidebarReducer(searching, sidebarActions.searchCleared()).searchQuery).toBe("");
	});

	it("restores persisted preferences without touching the session-only search", () => {
		const restored = sidebarReducer(
			state({ searchQuery: "rew" }),
			sidebarActions.preferencesRestored({ isOpen: false, sectionOrder: ["Wallet", "Rewards", "Insights"], expandedItems: { wallet: true } }),
		);

		expect(restored).toEqual({ isOpen: false, sectionOrder: ["Wallet", "Rewards", "Insights"], expandedItems: { wallet: true }, searchQuery: "rew" });
	});
});

describe("selectPreferences", () => {
	it("persists the rail, order and a capped set of expanded branches — never the search text", () => {
		const manyExpanded = Object.fromEntries(
			Array.from({ length: MAX_PERSISTED_EXPANDED_ITEMS + 5 }, (_, index: number): [string, boolean] => [`item-${String(index)}`, true]),
		);

		const preferences = selectPreferences(state({ searchQuery: "secret", expandedItems: manyExpanded }));

		expect(Object.keys(preferences.expandedItems)).toHaveLength(MAX_PERSISTED_EXPANDED_ITEMS);
		expect(preferences).not.toHaveProperty("searchQuery");
	});
});

describe("SidebarPreferencesSchema", () => {
	it("upgrades the envelope older builds wrote, filling missing fields with defaults", () => {
		const parsed = SidebarPreferencesSchema.parse({ state: { isOpen: false, sectionOrder: ["Docs", "Main"] }, version: 0 });

		expect(parsed).toEqual({ isOpen: false, sectionOrder: ["Docs", "Main"], expandedItems: {} });
	});

	it("rejects tampered values", () => {
		expect(SidebarPreferencesSchema.safeParse({ isOpen: "nope", sectionOrder: 42, expandedItems: {} }).success).toBe(false);
	});
});
