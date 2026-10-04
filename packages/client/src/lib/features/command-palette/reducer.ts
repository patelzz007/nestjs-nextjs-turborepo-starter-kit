import { assertNever } from "@workspace/shared";
import type { CommandPaletteAction } from "./actions";
import { MAX_RECENT_SEARCHES, type CommandPaletteRecentSearch, type CommandPaletteState } from "./state";

/** Newest first, one entry per URL (re-opening a page moves it to the front), capped. */
function withRecentSearch(recentSearches: readonly CommandPaletteRecentSearch[], item: CommandPaletteRecentSearch): readonly CommandPaletteRecentSearch[] {
	return [item, ...recentSearches.filter((entry) => entry.url !== item.url)].slice(0, MAX_RECENT_SEARCHES);
}

/** Unpins a pinned URL; pins any other URL at the front. */
function withPinToggled(pinnedUrls: readonly string[], url: string): readonly string[] {
	return pinnedUrls.includes(url) ? pinnedUrls.filter((entry) => entry !== url) : [url, ...pinnedUrls];
}

/** Pure command palette state transitions — no I/O, no browser APIs. */
export function commandPaletteReducer(state: CommandPaletteState, action: CommandPaletteAction): CommandPaletteState {
	switch (action.type) {
		case "[ Command Palette ] Recent Search Recorded":
			return { ...state, recentSearches: withRecentSearch(state.recentSearches, action.item) };
		case "[ Command Palette ] Pin Toggled":
			return { ...state, pinnedUrls: withPinToggled(state.pinnedUrls, action.url) };
		case "[ Command Palette ] Preferences Restored":
			// Storage is outside our control: hold a restored list to the same cap a recorded one gets.
			return { ...state, recentSearches: action.preferences.recentSearches.slice(0, MAX_RECENT_SEARCHES), pinnedUrls: action.preferences.pinnedUrls };
		default:
			return assertNever(action, "command palette action");
	}
}
