import type { RewardsViewMode, UiPreferences } from "./state";

/** Everything that can happen to the display preferences — the Redux DevTools timeline reads as these. */
export type UiPreferencesAction =
	| { readonly type: "[ UI Preferences ] Rewards View Mode Changed"; readonly mode: RewardsViewMode }
	| { readonly type: "[ UI Preferences ] Preferences Restored"; readonly preferences: UiPreferences };

/** Action creators — the only way components (through the facade) describe what happened. */
export const uiPreferencesActions = {
	rewardsViewModeChanged: (mode: RewardsViewMode): UiPreferencesAction => ({ type: "[ UI Preferences ] Rewards View Mode Changed", mode }),
	preferencesRestored: (preferences: UiPreferences): UiPreferencesAction => ({ type: "[ UI Preferences ] Preferences Restored", preferences }),
};
