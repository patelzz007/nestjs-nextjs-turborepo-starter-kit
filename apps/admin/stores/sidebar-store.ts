"use client";

import { z } from "zod";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Global sidebar state for the admin panel.
 *
 * Owns three pieces of UI state:
 * - `isOpen` — whether the desktop sidebar rail is expanded (persisted so the
 *   user's preference survives reloads).
 * - `sectionOrder` — the user's custom ordering of nav sections (persisted).
 *   `null` means "use the natural order from the menu config".
 * - `expandedItems` — manual nav expansions, **session-only** (deliberately NOT
 *   persisted): every refresh resets the menu to default. The current route's
 *   branch still auto-expands via `buildSidebarView`'s route state.
 */
export interface SidebarState {
	readonly isOpen: boolean;
	readonly sectionOrder: readonly string[] | null;
	/** Manually expanded nav items, keyed by compiled item id (sidebar audit #6). Session-only — resets on reload. */
	readonly expandedItems: Readonly<Record<string, boolean>>;
	/** Sidebar search query — SHARED between the desktop + mobile instances (audit #13), NOT persisted. */
	readonly searchQuery: string;
	readonly toggle: () => void;
	readonly open: () => void;
	readonly close: () => void;
	readonly moveSectionUp: (title: string, allTitles: readonly string[]) => void;
	readonly moveSectionDown: (title: string, allTitles: readonly string[]) => void;
	readonly setItemExpanded: (itemId: string, expanded: boolean) => void;
	readonly setSearchQuery: (query: string) => void;
	readonly clearSearch: () => void;
}

const STORAGE_KEY = "admin-sidebar-state";

/**
 * The persisted payload, as far as we'll trust it. `expandedItems` is
 * deliberately absent: legacy payloads written before the reset-on-reload
 * behavior still carry it, and the `merge` below drops it so a refresh always
 * restores the default menu.
 */
const PersistedSidebarSchema = z.object({
	isOpen: z.boolean().optional(),
	sectionOrder: z.array(z.string()).nullable().optional(),
});

/**
 * Moves `title` one position up/down within `order` and returns the new order.
 * When the section is unknown or already at the edge, the order is unchanged.
 */
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

/**
 * Returns the order the sections should currently render in.
 * A stored custom order wins when it matches the current section list length;
 * otherwise (e.g. after the menu config changed) the natural order is used.
 */
function resolveOrder(state: Pick<SidebarState, "sectionOrder">, allTitles: readonly string[]): readonly string[] {
	if (state.sectionOrder !== null && state.sectionOrder.length === allTitles.length) {
		return state.sectionOrder;
	}
	return allTitles;
}

export const useSidebarStore = create<SidebarState>()(
	persist(
		(set) => ({
			isOpen: true,
			sectionOrder: null,
			expandedItems: {},
			searchQuery: "",
			// Block bodies + explicit `(): void` satisfy both tsc and the ESLint
			// `explicit-function-return-type` rule — `set` is typed to return `unknown`
			// inside `persist`, so expression bodies would fail the void check.
			toggle: (): void => {
				set((state) => ({ isOpen: !state.isOpen }));
			},
			open: (): void => {
				set({ isOpen: true });
			},
			close: (): void => {
				set({ isOpen: false });
			},
			moveSectionUp: (title: string, allTitles: readonly string[]): void => {
				set((state) => ({
					sectionOrder: moveInOrder(resolveOrder(state, allTitles), title, -1),
				}));
			},
			moveSectionDown: (title: string, allTitles: readonly string[]): void => {
				set((state) => ({
					sectionOrder: moveInOrder(resolveOrder(state, allTitles), title, 1),
				}));
			},
			setItemExpanded: (itemId: string, expanded: boolean): void => {
				set((state) => {
					// Rebuild without the target key on collapse — a `false` entry is
					// dead weight in the in-memory map (the merge with auto-expanded
					// items treats absence as false). `delete` is banned by lint on
					// dynamic keys, so filter instead.
					const pruned = Object.fromEntries(Object.entries(state.expandedItems).filter(([key]) => key !== itemId));
					if (expanded) {
						pruned[itemId] = true;
					}
					return { expandedItems: pruned };
				});
			},
			setSearchQuery: (query: string): void => {
				set({ searchQuery: query });
			},
			clearSearch: (): void => {
				set({ searchQuery: "" });
			},
		}),
		{
			// Defaults to `localStorage` in v5 — no explicit storage needed.
			name: STORAGE_KEY,
			// The admin shell is now server-rendered with the store defaults; without
			// `skipHydration`, zustand would rehydrate from localStorage synchronously
			// at store creation on the client, so the first client render could differ
			// from the SSR HTML (e.g. a persisted collapsed sidebar vs the default
			// expanded one) and trigger a React hydration mismatch. Hydration is
			// instead kicked off once after mount in `DashboardLayout`.
			skipHydration: true,
			// `searchQuery` AND `expandedItems` are deliberately NOT persisted —
			// search and menu expansions reset on every reload (route-driven
			// auto-expansion still opens the active branch). `isOpen` and
			// `sectionOrder` survive. Missing keys in old persisted payloads keep
			// their defaults.
			partialize: (state): Pick<SidebarState, "isOpen" | "sectionOrder"> => ({
				isOpen: state.isOpen,
				sectionOrder: state.sectionOrder,
			}),
			// zustand's default shallow merge would resurrect `expandedItems` from
			// legacy localStorage payloads; this merge parses only the allowed keys
			// (zod — no unchecked casts) and always resets expansions to `{}`.
			merge: (persistedState, currentState) => {
				const parsed = PersistedSidebarSchema.safeParse(persistedState);
				if (!parsed.success) {
					return currentState;
				}
				return {
					...currentState,
					...parsed.data,
					expandedItems: {},
				};
			},
		},
	),
);

/** Convenience alias — callers can subscribe to the whole store or select a slice. */
export const useSidebar = useSidebarStore;
