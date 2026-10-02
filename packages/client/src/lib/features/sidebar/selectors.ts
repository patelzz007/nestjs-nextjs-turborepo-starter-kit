import { MAX_PERSISTED_EXPANDED_ITEMS, type SidebarPreferences, type SidebarState } from "./state";

export function selectIsOpen(state: SidebarState): boolean {
	return state.isOpen;
}

export function selectSectionOrder(state: SidebarState): readonly string[] | null {
	return state.sectionOrder;
}

export function selectExpandedItems(state: SidebarState): Readonly<Record<string, boolean>> {
	return state.expandedItems;
}

export function selectSearchQuery(state: SidebarState): string {
	return state.searchQuery;
}

/** What is written to storage: the preferences, with the expanded branches capped. */
export function selectPreferences(state: SidebarState): SidebarPreferences {
	return {
		isOpen: state.isOpen,
		sectionOrder: state.sectionOrder === null ? null : [...state.sectionOrder],
		expandedItems: Object.fromEntries(Object.entries(state.expandedItems).slice(0, MAX_PERSISTED_EXPANDED_ITEMS)),
	};
}
