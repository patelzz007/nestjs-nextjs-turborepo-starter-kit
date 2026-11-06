import type { AppLanguage } from "@workspace/shared";

import type { AppLockTimeoutMs, DrawerStyle, ThemePreference } from "../../lib/secure-store";
import type { PreferencesState } from "./state";

export function selectTheme(state: PreferencesState): ThemePreference {
	return state.theme;
}

export function selectDrawerStyle(state: PreferencesState): DrawerStyle {
	return state.drawerStyle;
}

export function selectAppLockEnabled(state: PreferencesState): boolean {
	return state.appLock.enabled;
}

export function selectLanguage(state: PreferencesState): AppLanguage | null {
	return state.language;
}

export function selectOnboardingCompleted(state: PreferencesState): boolean {
	return state.onboardingCompleted;
}

export function selectAppLockTimeoutMs(state: PreferencesState): AppLockTimeoutMs {
	return state.appLock.timeoutMs;
}
