// Goes to a destination the way the app's menus do (the drawer, the command palette): a tab is switched
// to; any other screen is pushed onto its tab's stack with the tab's first screen under it, so "back"
// lands there. The screen already on show is left as it is.

import { usePathname, useRouter } from "expo-router";
import * as React from "react";

import type { AppRoute } from "../../runtime/routes";

export function useOpenDestination(): (route: AppRoute, isTab: boolean) => void {
	const router = useRouter();
	const pathname = usePathname();
	return React.useCallback(
		(route: AppRoute, isTab: boolean): void => {
			if (route === pathname) {
				return;
			}
			if (isTab) {
				router.navigate(route);
			} else {
				// `withAnchor`: the tab's first screen goes underneath, so "back" lands on it.
				router.push(route, { withAnchor: true });
			}
		},
		[pathname, router],
	);
}
