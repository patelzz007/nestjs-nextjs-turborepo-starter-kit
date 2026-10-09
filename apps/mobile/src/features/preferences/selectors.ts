import type { AppLockTimeoutMs, ThemePreference } from "../../lib/secure-store";
import type { PreferencesState } from "./state";

export function selectTheme(state: PreferencesState): ThemePreference {
	return state.theme;
}

export function selectAppLockEnabled(state: PreferencesState): boolean {
	return state.appLock.enabled;
}

export function selectAppLockTimeoutMs(state: PreferencesState): AppLockTimeoutMs {
	return state.appLock.timeoutMs;
}
