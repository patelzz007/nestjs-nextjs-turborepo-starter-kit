"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Global sidebar state for the admin panel.
 *
 * Owns two pieces of UI state:
 * - `isOpen` — whether the desktop sidebar rail is expanded (persisted so the
 *   user's preference survives reloads).
 * - `sectionOrder` — the user's custom ordering of nav sections (persisted).
 *   `null` means "use the natural order from the menu config".
 */
export interface SidebarState {
	readonly isOpen: boolean;
	readonly sectionOrder: readonly string[] | null;
	readonly toggle: () => void;
	readonly open: () => void;
	readonly close: () => void;
	readonly moveSectionUp: (title: string, allTitles: readonly string[]) => void;
	readonly moveSectionDown: (title: string, allTitles: readonly string[]) => void;
}

const STORAGE_KEY = "admin-sidebar-state";

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
		}),
		{
			// Defaults to `localStorage` in v5 — no explicit storage needed.
			name: STORAGE_KEY,
		},
	),
);

/** Convenience alias — callers can subscribe to the whole store or select a slice. */
export const useSidebar = useSidebarStore;
