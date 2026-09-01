"use client";

import { z } from "zod";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { compileMenu } from "./sidebar-menu-compile";
import { SidebarMenuDataSchema, type CompiledSidebarMenuData, type SidebarMenuData } from "./sidebar-menu-schema";

/**
 * Panel sidebar UI state shared across web, admin, and merchant apps.
 *
 * - `menu` — compiled sidebar menu JSON (validated + ids attached at store init).
 * - `currentPage` / `previousPage` — route history for DevTools and consumers.
 * - `isOpen` — desktop rail expanded/collapsed (persisted).
 * - `sectionOrder` — custom nav section ordering (persisted); `null` uses menu config order.
 * - `expandedItems` — manually expanded nav branches (persisted, capped at 20).
 * - `searchQuery` — sidebar search text (session-only, not persisted).
 */
export interface SidebarState {
	readonly menu: CompiledSidebarMenuData;
	readonly currentPage: string | null;
	readonly previousPage: string | null;
	readonly isOpen: boolean;
	readonly sectionOrder: readonly string[] | null;
	readonly expandedItems: Readonly<Record<string, boolean>>;
	readonly searchQuery: string;
	readonly setMenu: (menuData: SidebarMenuData) => void;
	readonly setCurrentPage: (pathname: string) => void;
	readonly toggle: () => void;
	readonly open: () => void;
	readonly close: () => void;
	readonly moveSectionUp: (title: string, allTitles: readonly string[]) => void;
	readonly moveSectionDown: (title: string, allTitles: readonly string[]) => void;
	readonly setItemExpanded: (itemId: string, expanded: boolean) => void;
	readonly setSearchQuery: (query: string) => void;
	readonly clearSearch: () => void;
	readonly resetExpandedItems: () => void;
}

export interface CreateSidebarStoreOptions {
	/** localStorage key for persisted sidebar preferences. */
	readonly storageKey: string;
	/** Redux DevTools instance name (e.g. `WebSidebarStore`). */
	readonly devtoolsName: string;
	/** Validated sidebar menu JSON for this portal. */
	readonly initialMenuData: SidebarMenuData;
}

const PersistedSidebarSchema = z.object({
	isOpen: z.boolean().optional(),
	sectionOrder: z.array(z.string()).nullable().optional(),
	expandedItems: z.record(z.string(), z.boolean()).optional(),
});

function moveInOrder(order: readonly string[], title: string, direction: -1 | 1): readonly string[] {
	const currentIndex = order.indexOf(title);
	if (currentIndex === -1) {
		return order;
	}

	const targetIndex = currentIndex + direction;
	if (targetIndex < 0 || targetIndex >= order.length) {
		return order;
	}

	const next = [...order];
	const [moved] = next.splice(currentIndex, 1);
	if (moved !== undefined) {
		next.splice(targetIndex, 0, moved);
	}
	return next;
}

function resolveOrder(state: Pick<SidebarState, "sectionOrder">, allTitles: readonly string[]): readonly string[] {
	if (state.sectionOrder !== null && state.sectionOrder.length === allTitles.length) {
		return state.sectionOrder;
	}
	return allTitles;
}

function capExpandedItems(expandedItems: Readonly<Record<string, boolean>>): Readonly<Record<string, boolean>> {
	return Object.fromEntries(Object.entries(expandedItems).slice(0, 20));
}

/**
 * Creates a Zustand sidebar store with persist + Redux DevTools middleware.
 *
 * Each app passes a unique `storageKey`, `devtoolsName`, and its menu JSON so
 * preferences and DevTools traces stay isolated per portal.
 */
export function createSidebarStore(options: CreateSidebarStoreOptions) {
	const initialMenu = compileMenu(options.initialMenuData);

	return create<SidebarState>()(
		devtools(
			persist(
				(set) => ({
					menu: initialMenu,
					currentPage: null,
					previousPage: null,
					isOpen: true,
					sectionOrder: null,
					expandedItems: {},
					searchQuery: "",
					setMenu: (menuData: SidebarMenuData): void => {
						const parsed = SidebarMenuDataSchema.parse(menuData);
						set({ menu: compileMenu(parsed) }, false, "setMenu");
					},
					setCurrentPage: (pathname: string): void => {
						set(
							(state) => {
								if (state.currentPage === pathname) {
									return state;
								}
								return {
									previousPage: state.currentPage,
									currentPage: pathname,
								};
							},
							false,
							"setCurrentPage",
						);
					},
					toggle: (): void => {
						set((state) => ({ isOpen: !state.isOpen }), false, "toggle");
					},
					open: (): void => {
						set({ isOpen: true }, false, "open");
					},
					close: (): void => {
						set({ isOpen: false }, false, "close");
					},
					moveSectionUp: (title: string, allTitles: readonly string[]): void => {
						set(
							(state) => ({
								sectionOrder: moveInOrder(resolveOrder(state, allTitles), title, -1),
							}),
							false,
							"moveSectionUp",
						);
					},
					moveSectionDown: (title: string, allTitles: readonly string[]): void => {
						set(
							(state) => ({
								sectionOrder: moveInOrder(resolveOrder(state, allTitles), title, 1),
							}),
							false,
							"moveSectionDown",
						);
					},
					setItemExpanded: (itemId: string, expanded: boolean): void => {
						set(
							(state) => {
								const pruned = Object.fromEntries(Object.entries(state.expandedItems).filter(([key]) => key !== itemId));
								if (expanded) {
									pruned[itemId] = true;
								}
								return { expandedItems: pruned };
							},
							false,
							"setItemExpanded",
						);
					},
					setSearchQuery: (query: string): void => {
						set({ searchQuery: query }, false, "setSearchQuery");
					},
					clearSearch: (): void => {
						set({ searchQuery: "" }, false, "clearSearch");
					},
					resetExpandedItems: (): void => {
						set({ expandedItems: {} }, false, "resetExpandedItems");
					},
				}),
				{
					name: options.storageKey,
					skipHydration: true,
					partialize: (state): Pick<SidebarState, "isOpen" | "sectionOrder" | "expandedItems"> => ({
						isOpen: state.isOpen,
						sectionOrder: state.sectionOrder,
						expandedItems: capExpandedItems(state.expandedItems),
					}),
					merge: (persistedState, currentState) => {
						const parsed = PersistedSidebarSchema.safeParse(persistedState);
						if (!parsed.success) {
							return currentState;
						}
						const persistedExpanded = parsed.data.expandedItems ?? {};
						return {
							...currentState,
							...parsed.data,
							expandedItems: capExpandedItems(persistedExpanded),
						};
					},
				},
			),
			{
				name: options.devtoolsName,
				serialize: { depth: 4 },
			},
		),
	);
}
