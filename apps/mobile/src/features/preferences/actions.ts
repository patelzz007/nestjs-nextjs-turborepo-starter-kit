import type { AppLockTimeoutMs, ThemePreference } from "../../lib/secure-store";
import type { PreferencesState } from "./state";

export type PreferencesAction =
	| { readonly type: "[ Preferences ] Restored"; readonly preferences: PreferencesState }
	| { readonly type: "[ Preferences ] Theme Changed"; readonly theme: ThemePreference }
	| { readonly type: "[ Preferences ] App Lock Turned On" }
	| { readonly type: "[ Preferences ] App Lock Turned Off" }
	| { readonly type: "[ Preferences ] App Lock Timeout Changed"; readonly timeoutMs: AppLockTimeoutMs }
	| { readonly type: "[ Preferences ] Onboarding Completed" }
	| { readonly type: "[ Preferences ] Onboarding Reset" };

export const preferencesActions = {
	restored: (preferences: PreferencesState): PreferencesAction => ({ type: "[ Preferences ] Restored", preferences }),
	themeChanged: (theme: ThemePreference): PreferencesAction => ({ type: "[ Preferences ] Theme Changed", theme }),
	appLockTurnedOn: (): PreferencesAction => ({ type: "[ Preferences ] App Lock Turned On" }),
	appLockTurnedOff: (): PreferencesAction => ({ type: "[ Preferences ] App Lock Turned Off" }),
	appLockTimeoutChanged: (timeoutMs: AppLockTimeoutMs): PreferencesAction => ({ type: "[ Preferences ] App Lock Timeout Changed", timeoutMs }),
	onboardingCompleted: (): PreferencesAction => ({ type: "[ Preferences ] Onboarding Completed" }),
	/** Development builds only (Settings → About): onboarding shows again at the next sign-out. */
	onboardingReset: (): PreferencesAction => ({ type: "[ Preferences ] Onboarding Reset" }),
};
