"use client";

// ============================================
// lib/url-state/use-history-traversal.ts - Back / Forward as an event
// ============================================
// A URL-owned draft (a search box) resets when the URL value it shows changes.
// A history traversal can land on the value React last committed without that
// value ever changing: `history.pushState` hands the new URL to the Next.js
// router as a transition, and a Back that arrives before React commits that
// transition is rendered together with it, so the pushed value is never
// committed and the committed value goes "" → "". The draft would keep the
// submitted text while the URL and the results show the old search.
//
// So a traversal is a reset signal of its own: whatever the committed value
// did, the user moved through history, and the box must show the URL value of
// the entry they landed on.

import * as React from "react";

/**
 * How many history traversals (Back, Forward, `history.go`) happened since the
 * caller mounted — a value that changes on every traversal, for state to
 * reset on. `0` on the server and during hydration.
 *
 * Reads the Navigation API's `currententrychange` (only `traverse`
 * navigations: an in-page anchor click or a `pushState` is not one), and
 * falls back to `popstate` where the browser has no Navigation API — there an
 * in-page anchor click counts too, since `popstate` cannot tell it apart.
 */
export function useHistoryTraversalCount(): number {
	const [count, setCount] = React.useState<number>(0);
	React.useEffect((): (() => void) => {
		const countTraversal = (): void => {
			setCount((current: number): number => current + 1);
		};
		// The DOM types declare `window.navigation` as always there; older browsers have none.
		const navigation: Navigation | undefined = Reflect.has(window, "navigation") ? window.navigation : undefined;
		if (navigation !== undefined) {
			const onEntryChange = (event: NavigationCurrentEntryChangeEvent): void => {
				if (event.navigationType === "traverse") {
					countTraversal();
				}
			};
			navigation.addEventListener("currententrychange", onEntryChange);
			return (): void => {
				navigation.removeEventListener("currententrychange", onEntryChange);
			};
		}
		window.addEventListener("popstate", countTraversal);
		return (): void => {
			window.removeEventListener("popstate", countTraversal);
		};
	}, []);
	return count;
}
