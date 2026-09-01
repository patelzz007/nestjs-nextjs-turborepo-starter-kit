"use client";

import * as React from "react";

/**
 * Merges route-driven auto-expansion with manual toggles. Resets manual
 * expansions when the pathname changes so branches from the previous route
 * do not stay open.
 */
export function useRouteExpandedItems(
	pathname: string,
	storeExpandedItems: Readonly<Record<string, boolean>>,
	autoExpandedItems: Readonly<Record<string, boolean>>,
	resetExpandedItems: () => void,
): Readonly<Record<string, boolean>> {
	React.useLayoutEffect(() => {
		resetExpandedItems();
	}, [pathname, resetExpandedItems]);

	return React.useMemo(() => ({ ...storeExpandedItems, ...autoExpandedItems }), [storeExpandedItems, autoExpandedItems]);
}
