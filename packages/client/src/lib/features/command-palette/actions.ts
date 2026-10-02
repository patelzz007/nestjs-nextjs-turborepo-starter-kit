import type { CommandPalettePreferences, CommandPaletteRecentSearch } from "./state";

/** Everything that can happen to the command palette — the Redux DevTools timeline reads as these. */
export type CommandPaletteAction =
	| { readonly type: "[ Command Palette ] Recent Search Recorded"; readonly item: CommandPaletteRecentSearch }
	| { readonly type: "[ Command Palette ] Pin Toggled"; readonly url: string }
	| { readonly type: "[ Command Palette ] Preferences Restored"; readonly preferences: CommandPalettePreferences };

/** Action creators — the only way components (through the facade) describe what happened. */
export const commandPaletteActions = {
	recentSearchRecorded: (item: CommandPaletteRecentSearch): CommandPaletteAction => ({ type: "[ Command Palette ] Recent Search Recorded", item }),
	pinToggled: (url: string): CommandPaletteAction => ({ type: "[ Command Palette ] Pin Toggled", url }),
	preferencesRestored: (preferences: CommandPalettePreferences): CommandPaletteAction => ({ type: "[ Command Palette ] Preferences Restored", preferences }),
};
