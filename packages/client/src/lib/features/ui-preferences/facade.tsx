"use client";

import * as React from "react";

import { connectFeaturePersistence } from "../../state/feature-persistence";
import { createFeatureStoreContext } from "../../state/feature-store-context";
import { uiPreferencesActions, type UiPreferencesAction } from "./actions";
import { selectRewardsViewMode } from "./selectors";
import type { RewardsViewMode, UiPreferencesState } from "./state";
import { createUiPreferencesStore, uiPreferencesPersistence, type UiPreferencesStore } from "./store";

/**
 * Display preferences feature API — components use ONLY this module: read with
 * the narrow hooks, change state with `useUiPreferencesCommands()`. How the
 * state is stored (Zustand, actions, reducer) stays an implementation detail.
 */

/** The view mode values and their schema, for controls that parse a toggle's string value. */
export { RewardsViewModeSchema, type RewardsViewMode } from "./state";

const uiPreferencesContext = createFeatureStoreContext<UiPreferencesState, UiPreferencesAction>("UI Preferences");
const UiPreferencesContextProvider = uiPreferencesContext.provider;

export interface UiPreferencesStoreProviderProps {
	/** localStorage key for the persisted preferences (e.g. `rewardhub-view-mode`). */
	readonly storageKey: string;
	/** Redux DevTools instance name (e.g. `UI Preferences · web`). */
	readonly devtoolsName: string;
	readonly children: React.ReactNode;
}

/**
 * Mount once per app at the persistent layout boundary that encloses every
 * consumer (web: the root layout, because the landing page shows the catalog
 * too; merchant: the shell), so navigation keeps the preferences. Never nest
 * two providers with the same storage key — they would hold diverging copies.
 */
export function UiPreferencesStoreProvider({ storageKey, devtoolsName, children }: UiPreferencesStoreProviderProps): React.JSX.Element {
	const createStore = React.useCallback((): UiPreferencesStore => createUiPreferencesStore(devtoolsName), [devtoolsName]);
	const connectStorage = React.useCallback(
		(store: UiPreferencesStore): (() => void) => connectFeaturePersistence(store, window.localStorage, uiPreferencesPersistence(storageKey)),
		[storageKey],
	);
	return (
		<UiPreferencesContextProvider createStore={createStore} onMount={connectStorage}>
			{children}
		</UiPreferencesContextProvider>
	);
}

/** Grid or list layout of the rewards catalog (`grid` until the saved choice is restored after mount). */
export function useRewardsViewMode(): RewardsViewMode {
	return uiPreferencesContext.useFeatureSelector(selectRewardsViewMode);
}

export interface UiPreferencesCommands {
	/** Switches the rewards catalog between grid and list. */
	readonly changeRewardsViewMode: (mode: RewardsViewMode) => void;
}

/** Stable command functions (same identity for the provider's lifetime — safe in effect deps). */
export function useUiPreferencesCommands(): UiPreferencesCommands {
	const { dispatch } = uiPreferencesContext.useFeatureStore();
	return React.useMemo(
		(): UiPreferencesCommands => ({
			changeRewardsViewMode: (mode: RewardsViewMode): void => {
				dispatch(uiPreferencesActions.rewardsViewModeChanged(mode));
			},
		}),
		[dispatch],
	);
}
