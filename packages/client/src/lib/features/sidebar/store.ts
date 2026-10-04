import { parseStoredJson, UNVERSIONED_STORAGE_FORMAT, type FeaturePersistenceOptions } from "../../state/feature-persistence";
import { createFeatureStore, type FeatureStore } from "../../state/feature-store";
import { sidebarActions, type SidebarAction } from "./actions";
import { sidebarReducer } from "./reducer";
import { selectPreferences } from "./selectors";
import {
	INITIAL_SIDEBAR_STATE,
	LegacySidebarPreferencesSchema,
	SIDEBAR_PREFERENCES_VERSION,
	SidebarPreferencesSchema,
	type SidebarPreferences,
	type SidebarState,
} from "./state";

export type SidebarStore = FeatureStore<SidebarState, SidebarAction>;

/** One sidebar store (no effects: every sidebar change is a pure state transition). */
export function createSidebarStore(devtoolsName: string): SidebarStore {
	return createFeatureStore<SidebarState, SidebarAction>({
		name: devtoolsName,
		initialState: INITIAL_SIDEBAR_STATE,
		reducer: sidebarReducer,
	});
}

/**
 * Unversioned data (before 2026-10) → version 1: keeps the rail and section
 * order, drops the old unscoped expanded branches.
 * Removal: delete on or after 2027-01-01 (ADR 023, "Persisted formats").
 */
function upgradeUnversionedSidebarPreferences(storedText: string): SidebarPreferences | null {
	const legacy = parseStoredJson(storedText, LegacySidebarPreferencesSchema);
	return legacy === null ? null : { isOpen: legacy.isOpen, sectionOrder: legacy.sectionOrder, manualExpansion: null };
}

/** The rail, section order and this page's manual expansions survive a reload; the search text does not. */
export function sidebarPersistence(storageKey: string): FeaturePersistenceOptions<SidebarState, SidebarAction, SidebarPreferences> {
	return {
		key: storageKey,
		version: SIDEBAR_PREFERENCES_VERSION,
		schema: SidebarPreferencesSchema,
		migrations: [{ fromVersion: UNVERSIONED_STORAGE_FORMAT, upgrade: upgradeUnversionedSidebarPreferences }],
		select: selectPreferences,
		restore: sidebarActions.preferencesRestored,
	};
}
