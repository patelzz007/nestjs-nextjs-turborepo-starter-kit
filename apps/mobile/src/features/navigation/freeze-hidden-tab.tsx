// ============================================
// A tab out of sight stops re-rendering (enhancement 6.7)
// ============================================
// Expo Router's bottom tabs keep every visited tab mounted and never freeze them (their scene
// wrapper hard-codes `freezeOnBlur: false`), so an app-wide change (the theme, above all) re-renders
// every tab ever opened: the Analytics charts alone took over a second on a phone. Each tab is
// wrapped here instead: once the switch away has finished (its cross-fade, PAGE_CHANGE_MS), the
// tab is put in React's hidden Activity: it keeps its state, and its updates wait until nothing on
// screen needs rendering; focused again, it is shown at once.
// Past the switch away, its stack is reset, and the tab is hidden only once that reset has been applied (see
// FreezeHiddenTab). (react-freeze suspends a tree, and
// React 19 keeps re-trying suspended trees in the background: it rendered twice a second.)

import { unstable_useIsNavigating as useIsNavigating, useIsFocused } from "expo-router";
import { useNavigation, useNavigationState, useRoute } from "expo-router/react-navigation";
import * as React from "react";

import { PAGE_CHANGE_MS } from "@workspace/ui-native/lib/motion";

import { AT_FIRST_SCREEN, resetTabStack, tabStackDepth } from "./reset-tab-stack";

/** Whether this tab should be frozen: out of focus, and past the switch away from it (`onSettled` runs then). */
export function useFrozenWhileHidden(onSettled: () => void, settleMs: number = PAGE_CHANGE_MS): boolean {
	const focused = useIsFocused();
	const [settled, setSettled] = React.useState(false);
	if (focused && settled) {
		// Shown again: visible at once (adjusting state during render, React's documented pattern).
		setSettled(false);
	}
	React.useEffect((): (() => void) | undefined => {
		if (focused) {
			return undefined;
		}
		const timer = setTimeout((): void => {
			onSettled();
			setSettled(true);
		}, settleMs);
		return (): void => {
			clearTimeout(timer);
		};
	}, [focused, onSettled, settleMs]);
	return !focused && settled;
}

/**
 * One tab, frozen while out of sight. Past the switch away, its stack is reset (features/navigation/reset-tab-stack),
 * and the tab is hidden only once that reset has been applied and no navigation is still in flight. The hidden
 * Activity tears down the stack's registration, and while a navigation is pending React may reduce the reset again:
 * the tabs are preloaded in transitions (features/navigation/use-preloaded-tabs), and a reset applied ahead of a
 * pending preload is re-applied when the preload commits. Re-applied after the stack was gone, it was "The action
 * 'POP_TO_TOP' was not handled by any navigator".
 */
export function FreezeHiddenTab({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
	const navigation = useNavigation();
	const { key } = useRoute();
	const reset = React.useCallback((): void => {
		resetTabStack(navigation, key);
	}, [key, navigation]);
	// Subscribed: the tab re-renders when the reset lands, and only then hides.
	const atFirstScreen = useNavigationState((tabs) => tabStackDepth(tabs, key)) === AT_FIRST_SCREEN;
	const navigating = useIsNavigating();
	const hidden = useFrozenWhileHidden(reset) && atFirstScreen && !navigating;
	return <React.Activity mode={hidden ? "hidden" : "visible"}>{children}</React.Activity>;
}
