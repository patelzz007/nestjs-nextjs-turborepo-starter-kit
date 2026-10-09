// The preferences facade: the only module screens import (ADR 023).

import * as React from "react";

import type { AppLockTimeoutMs, ThemePreference } from "../../lib/secure-store";
import { createFeatureStoreContext } from "../../lib/state/feature-store-context";
import { preferencesActions, type PreferencesAction } from "./actions";
import { selectAppLockEnabled, selectAppLockTimeoutMs, selectTheme } from "./selectors";
import type { PreferencesState } from "./state";

const preferencesContext = createFeatureStoreContext<PreferencesState, PreferencesAction>("Preferences");

export const PreferencesStoreProvider = preferencesContext.provider;

export function useThemePreference(): ThemePreference {
	return preferencesContext.useFeatureSelector(selectTheme);
}

export function useAppLockEnabled(): boolean {
	return preferencesContext.useFeatureSelector(selectAppLockEnabled);
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
	readonly appLockTurnedOn: () => void;
	readonly appLockTurnedOff: () => void;
	readonly appLockTimeoutChanged: (timeoutMs: AppLockTimeoutMs) => void;
}

export function usePreferencesCommands(): PreferencesCommands {
	const { dispatch } = preferencesContext.useFeatureStore();
	return React.useMemo(
		(): PreferencesCommands => ({
			themeChanged: (theme: ThemePreference): void => {
				dispatch(preferencesActions.themeChanged(theme));
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
		}),
		[dispatch],
	);
}
