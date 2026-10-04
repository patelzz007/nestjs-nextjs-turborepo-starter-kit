import { parseStoredJson, UNVERSIONED_STORAGE_FORMAT, type FeaturePersistenceOptions } from "../../state/feature-persistence";
import { createFeatureStore, type FeatureStore } from "../../state/feature-store";
import { uiPreferencesActions, type UiPreferencesAction } from "./actions";
import { uiPreferencesReducer } from "./reducer";
import { selectPreferences } from "./selectors";
import {
	INITIAL_UI_PREFERENCES_STATE,
	LegacyRewardsViewModeSchema,
	LegacyUiPreferencesSnapshotSchema,
	UI_PREFERENCES_VERSION,
	UiPreferencesSchema,
	type UiPreferences,
	type UiPreferencesState,
} from "./state";

export type UiPreferencesStore = FeatureStore<UiPreferencesState, UiPreferencesAction>;

/** One display preferences store (no effects: every change is a pure state transition). */
export function createUiPreferencesStore(devtoolsName: string): UiPreferencesStore {
	return createFeatureStore<UiPreferencesState, UiPreferencesAction>({
		name: devtoolsName,
		initialState: INITIAL_UI_PREFERENCES_STATE,
		reducer: uiPreferencesReducer,
	});
}

/**
 * Unversioned data (before 2026-10) → version 1: the first feature store's JSON
 * snapshot, or the older helpers' bare `grid` / `list` text (not JSON at all).
 * Removal: delete on or after 2027-01-01 (ADR 023, "Persisted formats").
 */
function upgradeUnversionedUiPreferences(storedText: string): UiPreferences | null {
	const bareViewMode = LegacyRewardsViewModeSchema.safeParse(storedText);
	return bareViewMode.success ? bareViewMode.data : parseStoredJson(storedText, LegacyUiPreferencesSnapshotSchema);
}

/** Every display preference survives a reload. */
export function uiPreferencesPersistence(storageKey: string): FeaturePersistenceOptions<UiPreferencesState, UiPreferencesAction, UiPreferences> {
	return {
		key: storageKey,
		version: UI_PREFERENCES_VERSION,
		schema: UiPreferencesSchema,
		migrations: [{ fromVersion: UNVERSIONED_STORAGE_FORMAT, upgrade: upgradeUnversionedUiPreferences }],
		select: selectPreferences,
		restore: uiPreferencesActions.preferencesRestored,
	};
}
