import { assertNever } from "@workspace/shared";

import type { PreferencesAction } from "./actions";
import type { PreferencesState } from "./state";

/** Pure preference transitions — persistence and theme application are effects (store.ts). */
export function preferencesReducer(state: PreferencesState, action: PreferencesAction): PreferencesState {
	switch (action.type) {
		case "[ Preferences ] Restored":
			return action.preferences;
		case "[ Preferences ] Theme Changed":
			return { ...state, theme: action.theme };
		case "[ Preferences ] App Lock Turned On":
			return { ...state, appLock: { ...state.appLock, enabled: true } };
		case "[ Preferences ] App Lock Turned Off":
			return { ...state, appLock: { ...state.appLock, enabled: false } };
		case "[ Preferences ] App Lock Timeout Changed":
			return { ...state, appLock: { ...state.appLock, timeoutMs: action.timeoutMs } };
		case "[ Preferences ] Onboarding Completed":
			return { ...state, onboardingCompleted: true };
		case "[ Preferences ] Onboarding Reset":
			return { ...state, onboardingCompleted: false };
		default:
			return assertNever(action, "preferences action");
	}
}
