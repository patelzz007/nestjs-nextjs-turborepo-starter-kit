"use client";

import * as React from "react";

import { connectFeaturePersistence } from "../../state/feature-persistence";
import { createFeatureStoreContext } from "../../state/feature-store-context";
import { commandPaletteActions, type CommandPaletteAction } from "./actions";
import { selectPinnedUrls, selectRecentSearches } from "./selectors";
import type { CommandPaletteRecentSearch, CommandPaletteState } from "./state";
import { commandPalettePersistence, createCommandPaletteStore, type CommandPaletteStore } from "./store";

/**
 * Command palette feature API — components use ONLY this module: read with the
 * narrow hooks, change state with `useCommandPaletteCommands()`. How the state
 * is stored (Zustand, actions, reducer) stays an implementation detail.
 */

const commandPaletteContext = createFeatureStoreContext<CommandPaletteState, CommandPaletteAction>("Command Palette");
const CommandPaletteContextProvider = commandPaletteContext.provider;

export interface CommandPaletteStoreProviderProps {
	/** localStorage key for the persisted recents and pins (e.g. `command-palette-state`). */
	readonly storageKey: string;
	/** Redux DevTools instance name (e.g. `Command Palette · admin`). */
	readonly devtoolsName: string;
	readonly children: React.ReactNode;
}

/**
 * Mount once in the app's persistent shell layout, around every consumer (the
 * topbar's palette and the sidebar's pinned row), so navigation keeps the state.
 */
export function CommandPaletteStoreProvider({ storageKey, devtoolsName, children }: CommandPaletteStoreProviderProps): React.JSX.Element {
	const createStore = React.useCallback((): CommandPaletteStore => createCommandPaletteStore(devtoolsName), [devtoolsName]);
	const connectStorage = React.useCallback(
		(store: CommandPaletteStore): (() => void) => connectFeaturePersistence(store, window.localStorage, commandPalettePersistence(storageKey)),
		[storageKey],
	);
	return (
		<CommandPaletteContextProvider createStore={createStore} onMount={connectStorage}>
			{children}
		</CommandPaletteContextProvider>
	);
}

/** Pages recently opened from the palette, newest first. */
export function useCommandPaletteRecentSearches(): readonly CommandPaletteRecentSearch[] {
	return commandPaletteContext.useFeatureSelector(selectRecentSearches);
}

/** Pinned page URLs, most recently pinned first. */
export function useCommandPalettePinnedUrls(): readonly string[] {
	return commandPaletteContext.useFeatureSelector(selectPinnedUrls);
}

export interface CommandPaletteCommands {
	/** Records a page opened from the palette as the newest recent search. */
	readonly recordRecentSearch: (item: CommandPaletteRecentSearch) => void;
	/** Pins the URL, or unpins it when it is already pinned. */
	readonly togglePin: (url: string) => void;
}

/** Stable command functions (same identity for the provider's lifetime — safe in effect deps). */
export function useCommandPaletteCommands(): CommandPaletteCommands {
	const { dispatch } = commandPaletteContext.useFeatureStore();
	return React.useMemo(
		(): CommandPaletteCommands => ({
			recordRecentSearch: (item: CommandPaletteRecentSearch): void => {
				dispatch(commandPaletteActions.recentSearchRecorded(item));
			},
			togglePin: (url: string): void => {
				dispatch(commandPaletteActions.pinToggled(url));
			},
		}),
		[dispatch],
	);
}
