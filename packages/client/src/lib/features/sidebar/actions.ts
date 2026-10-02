import type { SidebarPreferences } from "./state";

/** -1 moves a section up the list, 1 moves it down. */
export type SectionMoveDirection = -1 | 1;

/** Everything that can happen to the sidebar — the Redux DevTools timeline reads as these. */
export type SidebarAction =
	| { readonly type: "[ Sidebar ] Toggled" }
	| { readonly type: "[ Sidebar ] Expanded" }
	| { readonly type: "[ Sidebar ] Collapsed" }
	| { readonly type: "[ Sidebar ] Section Moved"; readonly title: string; readonly direction: SectionMoveDirection; readonly allTitles: readonly string[] }
	| { readonly type: "[ Sidebar ] Item Expansion Changed"; readonly itemId: string; readonly expanded: boolean }
	| { readonly type: "[ Sidebar ] Expanded Items Reset" }
	| { readonly type: "[ Sidebar ] Search Changed"; readonly query: string }
	| { readonly type: "[ Sidebar ] Search Cleared" }
	| { readonly type: "[ Sidebar ] Preferences Restored"; readonly preferences: SidebarPreferences };

/** Action creators — the only way components (through the facade) describe what happened. */
export const sidebarActions = {
	toggled: (): SidebarAction => ({ type: "[ Sidebar ] Toggled" }),
	expanded: (): SidebarAction => ({ type: "[ Sidebar ] Expanded" }),
	collapsed: (): SidebarAction => ({ type: "[ Sidebar ] Collapsed" }),
	sectionMoved: (title: string, direction: SectionMoveDirection, allTitles: readonly string[]): SidebarAction => ({
		type: "[ Sidebar ] Section Moved",
		title,
		direction,
		allTitles,
	}),
	itemExpansionChanged: (itemId: string, expanded: boolean): SidebarAction => ({ type: "[ Sidebar ] Item Expansion Changed", itemId, expanded }),
	expandedItemsReset: (): SidebarAction => ({ type: "[ Sidebar ] Expanded Items Reset" }),
	searchChanged: (query: string): SidebarAction => ({ type: "[ Sidebar ] Search Changed", query }),
	searchCleared: (): SidebarAction => ({ type: "[ Sidebar ] Search Cleared" }),
	preferencesRestored: (preferences: SidebarPreferences): SidebarAction => ({ type: "[ Sidebar ] Preferences Restored", preferences }),
};
