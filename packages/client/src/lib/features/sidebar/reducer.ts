import { assertNever } from "@workspace/shared";
import type { SectionMoveDirection, SidebarAction } from "./actions";
import { MAX_MANUAL_EXPANDED_ITEMS, type SidebarManualExpansion, type SidebarState } from "./state";

/** The order a move applies to: the custom order while it still matches the menu, else the menu's own. */
function resolveOrder(sectionOrder: readonly string[] | null, allTitles: readonly string[]): readonly string[] {
	return sectionOrder !== null && sectionOrder.length === allTitles.length ? sectionOrder : allTitles;
}

function moveInOrder(order: readonly string[], title: string, direction: SectionMoveDirection): readonly string[] {
	const currentIndex = order.indexOf(title);
	const targetIndex = currentIndex + direction;
	if (currentIndex === -1 || targetIndex < 0 || targetIndex >= order.length) {
		return order;
	}
	const next = [...order];
	const [moved] = next.splice(currentIndex, 1);
	if (moved !== undefined) {
		next.splice(targetIndex, 0, moved);
	}
	return next;
}

/** Keeps the `max` most recently toggled entries (insertion order = toggle order, newest last). */
function keepNewest(items: Readonly<Record<string, boolean>>, max: number): Readonly<Record<string, boolean>> {
	const entries = Object.entries(items);
	return entries.length <= max ? items : Object.fromEntries(entries.slice(entries.length - max));
}

/**
 * Records a manual expand/collapse on `pathname`. Choices made on another page
 * are replaced, not merged — they only ever applied to that page. The toggled
 * item moves to the newest position, then the oldest beyond the cap drop off.
 */
function withManualExpansion(current: SidebarManualExpansion | null, pathname: string, itemId: string, expanded: boolean): SidebarManualExpansion {
	const samePage = current !== null && current.pathname === pathname ? current.items : {};
	const others = Object.entries(samePage).filter(([key]) => key !== itemId);
	return { pathname, items: keepNewest(Object.fromEntries([...others, [itemId, expanded]]), MAX_MANUAL_EXPANDED_ITEMS) };
}

function restoredManualExpansion(stored: SidebarManualExpansion | null): SidebarManualExpansion | null {
	return stored === null ? null : { pathname: stored.pathname, items: keepNewest(stored.items, MAX_MANUAL_EXPANDED_ITEMS) };
}

/** Pure sidebar state transitions — no I/O, no browser APIs. */
export function sidebarReducer(state: SidebarState, action: SidebarAction): SidebarState {
	switch (action.type) {
		case "[ Sidebar ] Toggled":
			return { ...state, isOpen: !state.isOpen };
		case "[ Sidebar ] Expanded":
			return { ...state, isOpen: true };
		case "[ Sidebar ] Collapsed":
			return { ...state, isOpen: false };
		case "[ Sidebar ] Section Moved":
			return { ...state, sectionOrder: moveInOrder(resolveOrder(state.sectionOrder, action.allTitles), action.title, action.direction) };
		case "[ Sidebar ] Item Expansion Changed":
			return { ...state, manualExpansion: withManualExpansion(state.manualExpansion, action.pathname, action.itemId, action.expanded) };
		case "[ Sidebar ] Search Changed":
			return { ...state, searchQuery: action.query };
		case "[ Sidebar ] Search Cleared":
			return { ...state, searchQuery: "" };
		case "[ Sidebar ] Preferences Restored":
			return {
				...state,
				isOpen: action.preferences.isOpen,
				sectionOrder: action.preferences.sectionOrder,
				manualExpansion: restoredManualExpansion(action.preferences.manualExpansion),
			};
		default:
			return assertNever(action, "sidebar action");
	}
}
