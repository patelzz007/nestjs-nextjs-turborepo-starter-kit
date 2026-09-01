"use client";

import * as React from "react";

function getMediaQuerySnapshot(query: string): boolean {
	return window.matchMedia(query).matches;
}

/**
 * Subscribes to a CSS media query and returns whether it currently matches.
 *
 * Uses `useSyncExternalStore` so viewport changes (including browser resize)
 * update in the same frame as the media query — not after a `useEffect` pass.
 * The server snapshot defaults to `false`; pass `serverSnapshot: true` for
 * mobile-first queries such as `(max-width: 1023px)`.
 */
export function useMediaQuery(query: string, serverSnapshot = false): boolean {
	const subscribe = React.useCallback(
		(onStoreChange: () => void): (() => void) => {
			const mediaQueryList = window.matchMedia(query);
			mediaQueryList.addEventListener("change", onStoreChange);
			return (): void => {
				mediaQueryList.removeEventListener("change", onStoreChange);
			};
		},
		[query],
	);

	const getSnapshot = React.useCallback((): boolean => {
		return getMediaQuerySnapshot(query);
	}, [query]);

	const getServerSnapshot = React.useCallback((): boolean => {
		return serverSnapshot;
	}, [serverSnapshot]);

	return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
