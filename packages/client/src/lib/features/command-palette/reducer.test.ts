import { describe, expect, it } from "vitest";
import { LIST_SLOT_INDEX } from "@workspace/shared";

import { commandPaletteActions } from "./actions";
import { commandPaletteReducer } from "./reducer";
import { selectPreferences } from "./selectors";
import { commandPalettePersistence } from "./store";
import { CommandPalettePreferencesSchema, INITIAL_COMMAND_PALETTE_STATE, MAX_RECENT_SEARCHES, type CommandPaletteRecentSearch, type CommandPaletteState } from "./state";

const BILLING: CommandPaletteRecentSearch = { title: "Billing", url: "/settings/billing", section: "Platform", icon: "CreditCard" };

function state(overrides: Partial<CommandPaletteState> = {}): CommandPaletteState {
	return { ...INITIAL_COMMAND_PALETTE_STATE, ...overrides };
}

function page(index: number): CommandPaletteRecentSearch {
	return { title: `Page ${String(index)}`, url: `/page-${String(index)}`, section: "Main" };
}

function pages(count: number): readonly CommandPaletteRecentSearch[] {
	return Array.from({ length: count }, (_, index: number): CommandPaletteRecentSearch => page(index));
}

describe("commandPaletteReducer", () => {
	it("records a recent search at the front", () => {
		const recorded = commandPaletteReducer(state({ recentSearches: [page(1)] }), commandPaletteActions.recentSearchRecorded(BILLING));

		expect(recorded.recentSearches).toEqual([BILLING, page(1)]);
	});

	it("caps recent searches, dropping the oldest", () => {
		const recorded = pages(MAX_RECENT_SEARCHES + 2).reduce(
			(current: CommandPaletteState, item: CommandPaletteRecentSearch): CommandPaletteState =>
				commandPaletteReducer(current, commandPaletteActions.recentSearchRecorded(item)),
			state(),
		);

		expect(recorded.recentSearches).toHaveLength(MAX_RECENT_SEARCHES);
		expect(recorded.recentSearches[LIST_SLOT_INDEX.first]).toEqual(page(MAX_RECENT_SEARCHES + 1));
		expect(recorded.recentSearches.map((entry) => entry.url)).not.toContain(page(1).url);
	});

	it("moves a re-opened page to the front instead of duplicating it", () => {
		const recorded = commandPaletteReducer(state({ recentSearches: [page(1), page(2), page(3)] }), commandPaletteActions.recentSearchRecorded(page(3)));

		expect(recorded.recentSearches).toEqual([page(3), page(1), page(2)]);
	});

	it("pins an unpinned URL at the front and unpins a pinned one", () => {
		const pinned = commandPaletteReducer(state({ pinnedUrls: ["/docs"] }), commandPaletteActions.pinToggled("/settings"));
		expect(pinned.pinnedUrls).toEqual(["/settings", "/docs"]);

		expect(commandPaletteReducer(pinned, commandPaletteActions.pinToggled("/docs")).pinnedUrls).toEqual(["/settings"]);
	});

	it("restores persisted preferences, holding the recents to the cap", () => {
		const restored = commandPaletteReducer(state(), commandPaletteActions.preferencesRestored({ recentSearches: pages(MAX_RECENT_SEARCHES + 3), pinnedUrls: ["/docs"] }));

		expect(restored).toEqual({ recentSearches: pages(MAX_RECENT_SEARCHES), pinnedUrls: ["/docs"] });
	});
});

describe("selectPreferences", () => {
	it("persists the recents and pins exactly as they are", () => {
		expect(selectPreferences(state({ recentSearches: [BILLING], pinnedUrls: ["/docs"] }))).toEqual({ recentSearches: [BILLING], pinnedUrls: ["/docs"] });
	});
});

describe("CommandPalettePreferencesSchema", () => {
	it("accepts the snapshot the feature store writes", () => {
		expect(CommandPalettePreferencesSchema.parse({ recentSearches: [BILLING], pinnedUrls: ["/docs"] })).toEqual({ recentSearches: [BILLING], pinnedUrls: ["/docs"] });
	});

	it("strips unknown keys from a stored recent search instead of rejecting the snapshot", () => {
		const parsed = CommandPalettePreferencesSchema.parse({ recentSearches: [{ ...BILLING, searchText: "bil" }], pinnedUrls: [] });

		expect(parsed.recentSearches).toEqual([BILLING]);
	});

	it("rejects tampered values and the old zustand/persist envelope", () => {
		expect(CommandPalettePreferencesSchema.safeParse({ recentSearches: "nope", pinnedUrls: 42 }).success).toBe(false);
		expect(CommandPalettePreferencesSchema.safeParse({ state: { recentSearches: [BILLING], pinnedUrls: ["/docs"] }, version: 0 }).success).toBe(false);
	});
});

describe("commandPalettePersistence", () => {
	it("has no migration steps: the per-member keys were only ever written in version 1 (the unowned key is deleted, not upgraded)", () => {
		expect(commandPalettePersistence("key").migrations).toEqual([]);
	});
});
