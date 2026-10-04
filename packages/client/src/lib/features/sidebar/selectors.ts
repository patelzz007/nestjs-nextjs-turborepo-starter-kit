import type { SidebarPreferences, SidebarState } from "./state";

/** Shared empty result, so "no manual choices" keeps one identity across renders. */
const NO_MANUAL_EXPANSION: Readonly<Record<string, boolean>> = {};

export function selectIsOpen(state: SidebarState): boolean {
	return state.isOpen;
}

export function selectSectionOrder(state: SidebarState): readonly string[] | null {
	return state.sectionOrder;
}

/** The manual expand/collapse choices that apply on `pathname` — none when they were made on another page. */
export function selectManualExpansionFor(state: SidebarState, pathname: string): Readonly<Record<string, boolean>> {
	const manual = state.manualExpansion;
	return manual !== null && manual.pathname === pathname ? manual.items : NO_MANUAL_EXPANSION;
}

/**
 * The branches open on `pathname`: route auto-expansion (the active item's
 * ancestors), overridden by the user's manual choices on this page — so a
 * manual collapse of the active branch sticks until they navigate.
 */
export function resolveExpandedItems(
	autoExpandedItems: Readonly<Record<string, boolean>>,
	manualExpansion: Readonly<Record<string, boolean>>,
): Readonly<Record<string, boolean>> {
	return { ...autoExpandedItems, ...manualExpansion };
}

export function selectSearchQuery(state: SidebarState): string {
	return state.searchQuery;
}

/** What is written to storage — named field by field, so the session-only search text is never persisted. */
export function selectPreferences(state: SidebarState): SidebarPreferences {
	return {
		isOpen: state.isOpen,
		sectionOrder: state.sectionOrder === null ? null : [...state.sectionOrder],
		manualExpansion: state.manualExpansion === null ? null : { pathname: state.manualExpansion.pathname, items: { ...state.manualExpansion.items } },
	};
}
