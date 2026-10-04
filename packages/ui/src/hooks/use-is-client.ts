"use client";

import * as React from "react";

/** Nothing ever changes after mount, so there is nothing to subscribe to. */
function subscribeToNothing(): () => void {
	return (): void => undefined;
}

function isClientSnapshot(): boolean {
	return true;
}

function isServerSnapshot(): boolean {
	return false;
}

/**
 * `false` during server rendering and hydration, `true` once the component
 * renders on the client.
 *
 * For UI that must read a browser-only value (an API's availability, the
 * resolved theme) without a hydration mismatch: the server and the hydrating
 * client both see `false`, then React re-renders with `true`. Built on
 * `useSyncExternalStore`, so it needs no `useEffect(() => setMounted(true))`
 * or `requestAnimationFrame` workaround and no extra state.
 */
export function useIsClient(): boolean {
	return React.useSyncExternalStore(subscribeToNothing, isClientSnapshot, isServerSnapshot);
}
