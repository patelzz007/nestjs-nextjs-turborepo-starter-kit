import type { AppLanguage } from "@workspace/shared";

import type { AppLockTimeoutMs, DrawerStyle, ThemePreference } from "../../lib/secure-store";
import type { PreferencesState } from "./state";

export type PreferencesAction =
	| { readonly type: "[ Preferences ] Restored"; readonly preferences: PreferencesState }
	| { readonly type: "[ Preferences ] Theme Changed"; readonly theme: ThemePreference }
	| { readonly type: "[ Preferences ] Drawer Style Changed"; readonly drawerStyle: DrawerStyle }
	| { readonly type: "[ Preferences ] App Lock Turned On" }
	| { readonly type: "[ Preferences ] App Lock Turned Off" }
	| { readonly type: "[ Preferences ] App Lock Timeout Changed"; readonly timeoutMs: AppLockTimeoutMs }
	| { readonly type: "[ Preferences ] Language Changed"; readonly language: AppLanguage }
	| { readonly type: "[ Preferences ] Onboarding Completed" }
	| { readonly type: "[ Preferences ] Reset" };

export const preferencesActions = {
	restored: (preferences: PreferencesState): PreferencesAction => ({ type: "[ Preferences ] Restored", preferences }),
	themeChanged: (theme: ThemePreference): PreferencesAction => ({ type: "[ Preferences ] Theme Changed", theme }),
	drawerStyleChanged: (drawerStyle: DrawerStyle): PreferencesAction => ({ type: "[ Preferences ] Drawer Style Changed", drawerStyle }),
	appLockTurnedOn: (): PreferencesAction => ({ type: "[ Preferences ] App Lock Turned On" }),
	appLockTurnedOff: (): PreferencesAction => ({ type: "[ Preferences ] App Lock Turned Off" }),
	appLockTimeoutChanged: (timeoutMs: AppLockTimeoutMs): PreferencesAction => ({ type: "[ Preferences ] App Lock Timeout Changed", timeoutMs }),
	languageChanged: (language: AppLanguage): PreferencesAction => ({ type: "[ Preferences ] Language Changed", language }),
	onboardingCompleted: (): PreferencesAction => ({ type: "[ Preferences ] Onboarding Completed" }),
	/** Development builds only (Settings → About): back to a fresh install, onboarding included, at the next sign-out. */
	reset: (): PreferencesAction => ({ type: "[ Preferences ] Reset" }),
};
