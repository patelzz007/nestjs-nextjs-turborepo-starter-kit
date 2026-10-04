"use client";

import * as React from "react";

import { browserStorage } from "../../state/browser-storage";
import { connectFeaturePersistence } from "../../state/feature-persistence";
import { createFeatureStoreContext } from "../../state/feature-store-context";
import { sidebarActions, type SidebarAction } from "./actions";
import { resolveExpandedItems, selectIsOpen, selectManualExpansionFor, selectSearchQuery, selectSectionOrder } from "./selectors";
import type { SidebarState } from "./state";
import { createSidebarStore, sidebarPersistence, type SidebarStore } from "./store";

/**
 * Sidebar feature API — components use ONLY this module: read with the
 * narrow hooks, change state with `useSidebarCommands()`. How the state is
 * stored (Zustand, actions, reducer) stays an implementation detail.
 */

const sidebarContext = createFeatureStoreContext<SidebarState, SidebarAction>("Sidebar");
const SidebarContextProvider = sidebarContext.provider;

export interface SidebarStoreProviderProps {
	/** localStorage key for the persisted preferences (e.g. `admin-sidebar-state`). */
	readonly storageKey: string;
	/** Redux DevTools instance name (e.g. `Sidebar · admin`). */
	readonly devtoolsName: string;
	readonly children: React.ReactNode;
}

/** Mount once in the app's persistent shell layout so navigation keeps the sidebar as it is. */
export function SidebarStoreProvider({ storageKey, devtoolsName, children }: SidebarStoreProviderProps): React.JSX.Element {
	const createStore = React.useCallback((): SidebarStore => createSidebarStore(devtoolsName), [devtoolsName]);
	const connectStorage = React.useCallback(
		(store: SidebarStore): (() => void) => connectFeaturePersistence(store, browserStorage("local"), sidebarPersistence(storageKey)),
		[storageKey],
	);
	return (
		<SidebarContextProvider createStore={createStore} onMount={connectStorage}>
			{children}
		</SidebarContextProvider>
	);
}

export function useSidebarIsOpen(): boolean {
	return sidebarContext.useFeatureSelector(selectIsOpen);
}

export function useSidebarSectionOrder(): readonly string[] | null {
	return sidebarContext.useFeatureSelector(selectSectionOrder);
}

/**
 * The nav branches open on `pathname`: `autoExpandedItems` (the route's active
 * ancestors, from `buildSidebarView`) overridden by the user's manual choices
 * made on this same page. Derived on every render — nothing resets on navigation.
 */
export function useSidebarExpandedItems(pathname: string, autoExpandedItems: Readonly<Record<string, boolean>>): Readonly<Record<string, boolean>> {
	const selectForPathname = React.useCallback((state: SidebarState): Readonly<Record<string, boolean>> => selectManualExpansionFor(state, pathname), [pathname]);
	const manualExpansion = sidebarContext.useFeatureSelector(selectForPathname);
	return React.useMemo(() => resolveExpandedItems(autoExpandedItems, manualExpansion), [autoExpandedItems, manualExpansion]);
}

export function useSidebarSearchQuery(): string {
	return sidebarContext.useFeatureSelector(selectSearchQuery);
}

export interface SidebarCommands {
	readonly toggle: () => void;
	readonly open: () => void;
	readonly close: () => void;
	readonly moveSectionUp: (title: string, allTitles: readonly string[]) => void;
	readonly moveSectionDown: (title: string, allTitles: readonly string[]) => void;
	/** Records a manual expand/collapse of `itemId` on the page at `pathname`. */
	readonly setItemExpanded: (pathname: string, itemId: string, expanded: boolean) => void;
	readonly setSearchQuery: (query: string) => void;
	readonly clearSearch: () => void;
}

/** Stable command functions (same identity for the provider's lifetime — safe in effect deps). */
export function useSidebarCommands(): SidebarCommands {
	const { dispatch } = sidebarContext.useFeatureStore();
	return React.useMemo(
		(): SidebarCommands => ({
			toggle: (): void => {
				dispatch(sidebarActions.toggled());
			},
			open: (): void => {
				dispatch(sidebarActions.expanded());
			},
			close: (): void => {
				dispatch(sidebarActions.collapsed());
			},
			moveSectionUp: (title: string, allTitles: readonly string[]): void => {
				dispatch(sidebarActions.sectionMoved(title, -1, allTitles));
			},
			moveSectionDown: (title: string, allTitles: readonly string[]): void => {
				dispatch(sidebarActions.sectionMoved(title, 1, allTitles));
			},
			setItemExpanded: (pathname: string, itemId: string, expanded: boolean): void => {
				dispatch(sidebarActions.itemExpansionChanged(pathname, itemId, expanded));
			},
			setSearchQuery: (query: string): void => {
				dispatch(sidebarActions.searchChanged(query));
			},
			clearSearch: (): void => {
				dispatch(sidebarActions.searchCleared());
			},
		}),
		[dispatch],
	);
}
