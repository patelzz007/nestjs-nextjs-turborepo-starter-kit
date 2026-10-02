import type { FeaturePersistenceOptions } from "../../state/feature-persistence";
import { createFeatureStore, type FeatureStore } from "../../state/feature-store";
import { uiPreferencesActions, type UiPreferencesAction } from "./actions";
import { uiPreferencesReducer } from "./reducer";
import { selectPreferences } from "./selectors";
import { INITIAL_UI_PREFERENCES_STATE, UiPreferencesSchema, type UiPreferences, type UiPreferencesState } from "./state";

export type UiPreferencesStore = FeatureStore<UiPreferencesState, UiPreferencesAction>;

/** One display preferences store (no effects: every change is a pure state transition). */
export function createUiPreferencesStore(devtoolsName: string): UiPreferencesStore {
	return createFeatureStore<UiPreferencesState, UiPreferencesAction>({
		name: devtoolsName,
		initialState: INITIAL_UI_PREFERENCES_STATE,
		reducer: uiPreferencesReducer,
	});
}

/** Every display preference survives a reload. */
export function uiPreferencesPersistence(storageKey: string): FeaturePersistenceOptions<UiPreferencesState, UiPreferencesAction, UiPreferences> {
	return {
		key: storageKey,
		schema: UiPreferencesSchema,
		select: selectPreferences,
		restore: uiPreferencesActions.preferencesRestored,
	};
}
