// ============================================
// Leaving a tab resets its stack (Settings shows Settings when you come back, not the sub-screen last open)
// ============================================
// The app does this itself rather than with the tab navigator's `popToTopOnBlur`: that sends POP_TO_TOP to a
// tab's stack whether or not it is deeper than its first screen, and expo-router reports each one with nothing to
// pop as "The action 'POP_TO_TOP' was not handled by any navigator". A reset is queued, applied on a later render:
// the tab is frozen (features/navigation/freeze-hidden-tab, which tears down the stack's registration) only
// once its stack is back at its first screen ({@link tabStackDepth} is 0), never in the same update.

import { StackActions, type NavigationAction, type NavigationState } from "expo-router/react-navigation";

/** What the reset needs of the tab navigator. */
export interface TabNavigatorHandle {
	/** The tab navigator's state; `undefined` before it has any. */
	readonly getState: () => NavigationState | undefined;
	readonly dispatch: (action: NavigationAction) => void;
}

/** A stack's depth at its first screen. */
export const AT_FIRST_SCREEN = 0;

/** How many screens the tab's own stack is above its first one: 0 at its first screen, or for a tab with no stack. */
export function tabStackDepth(tabs: NavigationState, tabRouteKey: string): number {
	return tabs.routes.find((route) => route.key === tabRouteKey)?.state?.index ?? AT_FIRST_SCREEN;
}

/** Pops the tab's own stack back to its first screen; nothing for a tab with no stack, or one already there. */
export function resetTabStack(navigator: TabNavigatorHandle, tabRouteKey: string): void {
	const tabs = navigator.getState();
	if (tabs === undefined) {
		return;
	}
	const stack = tabs.routes.find((route) => route.key === tabRouteKey)?.state;
	if (stack?.key === undefined || tabStackDepth(tabs, tabRouteKey) === AT_FIRST_SCREEN) {
		return;
	}
	navigator.dispatch({ ...StackActions.popToTop(), target: stack.key });
}
