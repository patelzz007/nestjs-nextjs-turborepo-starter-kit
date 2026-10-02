import type { CommandPalettePreferences, CommandPaletteRecentSearch, CommandPaletteState } from "./state";

export function selectRecentSearches(state: CommandPaletteState): readonly CommandPaletteRecentSearch[] {
	return state.recentSearches;
}

export function selectPinnedUrls(state: CommandPaletteState): readonly string[] {
	return state.pinnedUrls;
}

/** What is written to storage — named field by field, so a future session-only field is never persisted by accident. */
export function selectPreferences(state: CommandPaletteState): CommandPalettePreferences {
	return {
		recentSearches: state.recentSearches,
		pinnedUrls: state.pinnedUrls,
	};
}
