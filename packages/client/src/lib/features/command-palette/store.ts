import type { FeaturePersistenceOptions } from "../../state/feature-persistence";
import { createFeatureStore, type FeatureStore } from "../../state/feature-store";
import { commandPaletteActions, type CommandPaletteAction } from "./actions";
import { commandPaletteReducer } from "./reducer";
import { selectPreferences } from "./selectors";
import { CommandPalettePreferencesSchema, INITIAL_COMMAND_PALETTE_STATE, type CommandPalettePreferences, type CommandPaletteState } from "./state";

export type CommandPaletteStore = FeatureStore<CommandPaletteState, CommandPaletteAction>;

/** One command palette store (no effects: every palette change is a pure state transition). */
export function createCommandPaletteStore(devtoolsName: string): CommandPaletteStore {
	return createFeatureStore<CommandPaletteState, CommandPaletteAction>({
		name: devtoolsName,
		initialState: INITIAL_COMMAND_PALETTE_STATE,
		reducer: commandPaletteReducer,
	});
}

/** Recent searches and pins survive a reload; the palette's search text never reaches the store. */
export function commandPalettePersistence(storageKey: string): FeaturePersistenceOptions<CommandPaletteState, CommandPaletteAction, CommandPalettePreferences> {
	return {
		key: storageKey,
		schema: CommandPalettePreferencesSchema,
		select: selectPreferences,
		restore: commandPaletteActions.preferencesRestored,
	};
}
