"use client";

import * as React from "react";

import { browserStorage } from "../../state/browser-storage";
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
	/** Base localStorage key (e.g. `command-palette-state`); the data is stored per member under `<key>:<ownerId>`. */
	readonly storageKey: string;
	/**
	 * The signed-in member the recents and pins belong to (`useAuthUser()?.id`),
	 * `null` while nobody is signed in. Recents are personal browsing history:
	 * they are never shown to — or persisted for — anyone else on this browser.
	 */
	readonly ownerId: string | null;
	/** Redux DevTools instance name (e.g. `Command Palette · admin`). */
	readonly devtoolsName: string;
	readonly children: React.ReactNode;
}

/** The storage key of one member's palette state. */
export function commandPaletteStorageKey(storageKey: string, ownerId: string): string {
	return `${storageKey}:${ownerId}`;
}

/**
 * Mount once in the app's persistent shell layout, around every consumer (the
 * topbar's palette and the sidebar's pinned row), so navigation keeps the state.
 * A new owner (sign-in, sign-out, impersonation) gets a fresh store; signing
 * out removes the previous member's stored recents and pins from the browser.
 * The pre-scoping, unowned key is removed: whose data it holds cannot be known.
 */
export function CommandPaletteStoreProvider({ storageKey, ownerId, devtoolsName, children }: CommandPaletteStoreProviderProps): React.JSX.Element {
	const previousOwnerRef = React.useRef<string | null>(ownerId);

	React.useEffect((): void => {
		const storage = browserStorage("local");
		storage.removeItem(storageKey);
		const previousOwner = previousOwnerRef.current;
		if (previousOwner !== null && previousOwner !== ownerId) {
			storage.removeItem(commandPaletteStorageKey(storageKey, previousOwner));
		}
		previousOwnerRef.current = ownerId;
	}, [ownerId, storageKey]);

	return (
		<OwnedCommandPaletteStore key={ownerId ?? NO_OWNER} storageKey={storageKey} ownerId={ownerId} devtoolsName={devtoolsName}>
			{children}
		</OwnedCommandPaletteStore>
	);
}

/** React key of the store while nobody is signed in. */
const NO_OWNER = "no-owner";

function OwnedCommandPaletteStore({ storageKey, ownerId, devtoolsName, children }: CommandPaletteStoreProviderProps): React.JSX.Element {
	const createStore = React.useCallback((): CommandPaletteStore => createCommandPaletteStore(devtoolsName), [devtoolsName]);
	const connectStorage = React.useCallback(
		(store: CommandPaletteStore): (() => void) =>
			// Nobody signed in: nothing is remembered.
			ownerId === null
				? (): void => undefined
				: connectFeaturePersistence(store, browserStorage("local"), commandPalettePersistence(commandPaletteStorageKey(storageKey, ownerId))),
		[ownerId, storageKey],
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
