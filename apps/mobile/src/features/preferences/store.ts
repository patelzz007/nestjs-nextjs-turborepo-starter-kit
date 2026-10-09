import type { ThemePreference } from "../../lib/secure-store";
import { createFeatureStore, type FeatureEffect, type FeatureStore } from "../../lib/state/feature-store";
import type { PreferencesAction } from "./actions";
import { preferencesReducer } from "./reducer";
import { DEFAULT_PREFERENCES, type PreferencesState } from "./state";

export type PreferencesStore = FeatureStore<PreferencesState, PreferencesAction>;

export interface PreferencesStoreDependencies {
	/** Applies the appearance to the UI (Uniwind.setTheme). */
	readonly applyTheme: (theme: ThemePreference) => void;
	/** Stores the preferences (Secure Store). */
	readonly save: (preferences: PreferencesState) => Promise<void>;
	/** A save failed: the preference holds for this run but will not survive a restart. */
	readonly onSaveFailed: (error: Error) => void;
}

/** The appearance follows every restore and change at once. */
function applyThemeEffect(dependencies: PreferencesStoreDependencies): FeatureEffect<PreferencesState, PreferencesAction> {
	return (action: PreferencesAction, { getState }): void => {
		if (action.type === "[ Preferences ] Restored" || action.type === "[ Preferences ] Theme Changed") {
			dependencies.applyTheme(getState().theme);
		}
	};
}

/** Every user change is written to Secure Store (a restore is already what is stored). */
function persistEffect(dependencies: PreferencesStoreDependencies): FeatureEffect<PreferencesState, PreferencesAction> {
	return (action: PreferencesAction, { getState }): void => {
		if (action.type === "[ Preferences ] Restored") {
			return;
		}
		dependencies.save(getState()).catch((error: unknown): void => {
			dependencies.onSaveFailed(error instanceof Error ? error : new Error("Saving the preferences failed"));
		});
	};
}

export function createPreferencesStore(dependencies: PreferencesStoreDependencies): PreferencesStore {
	return createFeatureStore<PreferencesState, PreferencesAction>({
		initialState: DEFAULT_PREFERENCES,
		reducer: preferencesReducer,
		effects: [applyThemeEffect(dependencies), persistEffect(dependencies)],
	});
}
