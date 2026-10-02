import type { UiPreferencesAction } from "./actions";
import type { UiPreferencesState } from "./state";

/** Pure display preference transitions — no I/O, no browser APIs. */
export function uiPreferencesReducer(state: UiPreferencesState, action: UiPreferencesAction): UiPreferencesState {
	switch (action.type) {
		case "[ UI Preferences ] Rewards View Mode Changed":
			return { ...state, rewardsViewMode: action.mode };
		case "[ UI Preferences ] Preferences Restored":
			return { ...state, rewardsViewMode: action.preferences.rewardsViewMode };
		default:
			return assertNever(action);
	}
}

/** Exhaustiveness check: adding an action without handling it fails to compile. */
function assertNever(action: never): never {
	throw new Error(`Unhandled UI preferences action: ${JSON.stringify(action)}`);
}
