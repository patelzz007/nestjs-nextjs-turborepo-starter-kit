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

/** The state without any hand-made expand/collapse choice (unchanged when there is none). */
function withoutManualExpansion(state: SidebarState): SidebarState {
	return state.manualExpansion === null ? state : { ...state, manualExpansion: null };
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
		case "[ Sidebar ] Link Followed":
			// A link to the page already shown navigates nowhere, so it resets the hand-opened branches now. A link to
			// another page changes nothing yet: the branches stay as they are while that page loads (closing them on the
			// click would fold the menu away under the pointer), and are dropped when the route really changes.
			return action.targetPathname === action.currentPathname ? withoutManualExpansion(state) : state;
		case "[ Sidebar ] Route Changed":
			// Choices made on another page never applied here: drop them, so returning to that page later starts from its route.
			return state.manualExpansion !== null && state.manualExpansion.pathname !== action.pathname ? withoutManualExpansion(state) : state;
		case "[ Sidebar ] Search Changed":
			return { ...state, searchQuery: action.query };
		case "[ Sidebar ] Search Cleared":
			return { ...state, searchQuery: "" };
		case "[ Sidebar ] Preferences Restored":
			return { ...state, isOpen: action.preferences.isOpen, sectionOrder: action.preferences.sectionOrder };
		default:
			return assertNever(action, "sidebar action");
	}
}
