"use client";

import * as React from "react";

function subscribeToScroll(onChange: () => void): () => void {
	window.addEventListener("scroll", onChange, { passive: true });
	return (): void => {
		window.removeEventListener("scroll", onChange);
	};
}

/**
 * `true` once the page is scrolled more than `thresholdPx` from the top.
 * Server render (and the first client render) report `false` — the page loads
 * at the top — so the markup matches and there is no hydration flicker.
 */
export function useScrolledPast(thresholdPx: number): boolean {
	return React.useSyncExternalStore(
		subscribeToScroll,
		(): boolean => window.scrollY > thresholdPx,
		(): boolean => false,
	);
}
