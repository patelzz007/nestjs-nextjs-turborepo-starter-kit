import type { FeaturePersistenceOptions } from "../../state/feature-persistence";
import { createFeatureStore, type FeatureStore } from "../../state/feature-store";
import { sidebarActions, type SidebarAction } from "./actions";
import { sidebarReducer } from "./reducer";
import { selectPreferences } from "./selectors";
import { INITIAL_SIDEBAR_STATE, SidebarPreferencesSchema, type SidebarPreferences, type SidebarState } from "./state";

export type SidebarStore = FeatureStore<SidebarState, SidebarAction>;

/** One sidebar store (no effects: every sidebar change is a pure state transition). */
export function createSidebarStore(devtoolsName: string): SidebarStore {
	return createFeatureStore<SidebarState, SidebarAction>({
		name: devtoolsName,
		initialState: INITIAL_SIDEBAR_STATE,
		reducer: sidebarReducer,
	});
}

/** The rail, section order and expanded branches survive a reload; the search text does not. */
export function sidebarPersistence(storageKey: string): FeaturePersistenceOptions<SidebarState, SidebarAction, SidebarPreferences> {
	return {
		key: storageKey,
		schema: SidebarPreferencesSchema,
		select: selectPreferences,
		restore: sidebarActions.preferencesRestored,
	};
}
