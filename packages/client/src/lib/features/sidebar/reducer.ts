import type { SectionMoveDirection, SidebarAction } from "./actions";
import type { SidebarState } from "./state";

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

function withItemExpansion(expandedItems: Readonly<Record<string, boolean>>, itemId: string, expanded: boolean): Readonly<Record<string, boolean>> {
	const others = Object.entries(expandedItems).filter(([key]) => key !== itemId);
	return Object.fromEntries(expanded ? [...others, [itemId, true]] : others);
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
			return { ...state, expandedItems: withItemExpansion(state.expandedItems, action.itemId, action.expanded) };
		case "[ Sidebar ] Expanded Items Reset":
			return { ...state, expandedItems: {} };
		case "[ Sidebar ] Search Changed":
			return { ...state, searchQuery: action.query };
		case "[ Sidebar ] Search Cleared":
			return { ...state, searchQuery: "" };
		case "[ Sidebar ] Preferences Restored":
			return { ...state, ...action.preferences };
		default:
			return assertNever(action);
	}
}

/** Exhaustiveness check: adding an action without handling it fails to compile. */
function assertNever(action: never): never {
	throw new Error(`Unhandled sidebar action: ${JSON.stringify(action)}`);
}
