"use client";

import * as React from "react";

import { browserStorage } from "../../state/browser-storage";
import { connectFeaturePersistence } from "../../state/feature-persistence";
import { createFeatureStoreContext } from "../../state/feature-store-context";
import { sidebarActions, type SidebarAction } from "./actions";
import { resolveExpandedItems, selectIsOpen, selectManualExpansionFor, selectSearchQuery, selectSectionOrder } from "./selectors";
import type { SidebarState } from "./state";
import { createSidebarStore, sidebarPersistence, type SidebarStore } from "./store";
import { SIDEBAR_OPEN_COOKIE_MAX_AGE_SECONDS, sidebarOpenCookieName } from "./open-cookie";
import { createCookieSidebarStorage } from "@workspace/ui/lib/sidebar/storage";

/**
 * Keeps the sidebar's cookie (open-cookie.ts) equal to the store's open state —
 * once now (after the stored preferences are restored) and on every change —
 * so the server can render the next page load as it was left.
 */
function mirrorOpenStateToCookie(store: SidebarStore, storageKey: string): () => void {
	const cookie = createCookieSidebarStorage({ cookieName: sidebarOpenCookieName(storageKey), maxAgeSeconds: SIDEBAR_OPEN_COOKIE_MAX_AGE_SECONDS });
	cookie.write(store.getState().isOpen);
	return store.subscribe((state: SidebarState, previousState: SidebarState): void => {
		if (state.isOpen !== previousState.isOpen) {
			cookie.write(state.isOpen);
		}
	});
}

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
	/**
	 * The open state the server rendered — `readSidebarOpenCookie` in the app's
	 * server layout — so the first paint shows the sidebar as it was left
	 * (no open-then-close flash). Omitted: open.
	 */
	readonly initialIsOpen?: boolean | undefined;
	readonly children: React.ReactNode;
}

/** Mount once in the app's persistent shell layout so navigation keeps the sidebar as it is. */
export function SidebarStoreProvider({ storageKey, devtoolsName, initialIsOpen, children }: SidebarStoreProviderProps): React.JSX.Element {
	const createStore = React.useCallback((): SidebarStore => createSidebarStore(devtoolsName, initialIsOpen), [devtoolsName, initialIsOpen]);
	const connectStorage = React.useCallback(
		(store: SidebarStore): (() => void) => {
			const disconnectPersistence = connectFeaturePersistence(store, browserStorage("local"), sidebarPersistence(storageKey));
			const disconnectCookie = mirrorOpenStateToCookie(store, storageKey);
			return (): void => {
				disconnectCookie();
				disconnectPersistence();
			};
		},
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
 * made on this same page since the last followed sidebar link. Derived on
 * every render; manual choices are session-only, so a reload shows only the
 * route's branches.
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
	/** A sidebar link was followed: drops every manual expand/collapse, so only the route's branches stay open. */
	readonly resetItemExpansion: () => void;
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
			resetItemExpansion: (): void => {
				dispatch(sidebarActions.linkFollowed());
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
