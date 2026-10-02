import type { RewardsViewMode, UiPreferences, UiPreferencesState } from "./state";

export function selectRewardsViewMode(state: UiPreferencesState): RewardsViewMode {
	return state.rewardsViewMode;
}

/** What is written to storage — named field by field, so a future session-only field is never persisted by accident. */
export function selectPreferences(state: UiPreferencesState): UiPreferences {
	return {
		rewardsViewMode: state.rewardsViewMode,
	};
}
