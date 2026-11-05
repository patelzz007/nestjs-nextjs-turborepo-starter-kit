// The preferences facade: the only module screens import (ADR 023).

import type { AppLanguage } from "@workspace/shared";
import * as React from "react";

import type { AppLockTimeoutMs, ThemePreference } from "../../lib/secure-store";
import { createFeatureStoreContext } from "../../lib/state/feature-store-context";
import { preferencesActions, type PreferencesAction } from "./actions";
import { selectAppLockEnabled, selectAppLockTimeoutMs, selectLanguage, selectOnboardingCompleted, selectTheme } from "./selectors";
import type { PreferencesState } from "./state";

const preferencesContext = createFeatureStoreContext<PreferencesState, PreferencesAction>("Preferences");

export const PreferencesStoreProvider = preferencesContext.provider;

export function useThemePreference(): ThemePreference {
	return preferencesContext.useFeatureSelector(selectTheme);
}

export function useAppLockEnabled(): boolean {
	return preferencesContext.useFeatureSelector(selectAppLockEnabled);
}

/** Whether this device has been through onboarding (the root guard reads it). */
export function useOnboardingCompleted(): boolean {
	return preferencesContext.useFeatureSelector(selectOnboardingCompleted);
}

/** The language this device chose, or `null` while it follows the phone (features/language reads it). */
export function useLanguagePreference(): AppLanguage | null {
	return preferencesContext.useFeatureSelector(selectLanguage);
}

export function useAppLockTimeoutMs(): AppLockTimeoutMs {
	return preferencesContext.useFeatureSelector(selectAppLockTimeoutMs);
}

/** The current preferences without subscribing — for event handlers (AppState changes). */
export function usePreferencesSnapshot(): () => PreferencesState {
	return preferencesContext.useFeatureStore().getState;
}

export interface PreferencesCommands {
	readonly themeChanged: (theme: ThemePreference) => void;
	readonly languageChanged: (language: AppLanguage) => void;
	readonly appLockTurnedOn: () => void;
	readonly appLockTurnedOff: () => void;
	readonly appLockTimeoutChanged: (timeoutMs: AppLockTimeoutMs) => void;
	readonly onboardingCompleted: () => void;
	readonly onboardingReset: () => void;
}

export function usePreferencesCommands(): PreferencesCommands {
	const { dispatch } = preferencesContext.useFeatureStore();
	return React.useMemo(
		(): PreferencesCommands => ({
			themeChanged: (theme: ThemePreference): void => {
				dispatch(preferencesActions.themeChanged(theme));
			},
			languageChanged: (language: AppLanguage): void => {
				dispatch(preferencesActions.languageChanged(language));
			},
			appLockTurnedOn: (): void => {
				dispatch(preferencesActions.appLockTurnedOn());
			},
			appLockTurnedOff: (): void => {
				dispatch(preferencesActions.appLockTurnedOff());
			},
			appLockTimeoutChanged: (timeoutMs: AppLockTimeoutMs): void => {
				dispatch(preferencesActions.appLockTimeoutChanged(timeoutMs));
			},
			onboardingCompleted: (): void => {
				dispatch(preferencesActions.onboardingCompleted());
			},
			onboardingReset: (): void => {
				dispatch(preferencesActions.onboardingReset());
			},
		}),
		[dispatch],
	);
}
