"use client";

// ============================================
// lib/url-state/url-state-test-provider.tsx - the URL-state engine for tests
// ============================================
// Component tests have no Next.js router. This runs the same engine
// (`useUrlState` on nuqs) against the jsdom address bar instead: it starts
// from `window.location`, writes every update through the real History API
// (so a test can assert `window.location.search` or spy on `pushState`),
// follows Back / Forward (`popstate`) and a test's own address-bar change on
// its next render, and clears nuqs's shared update queue on mount so one
// test's writes never leak into the next. URL writes land on the next tick, as
// in the browser: await `flushUrlUpdates()` (testing/flush-url-updates) first.

import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import * as React from "react";

export interface UrlStateTestProviderProps {
	readonly children: React.ReactNode;
}

/** Writes one nuqs URL update to the jsdom address bar, as the browser adapter does. */
export function writeUrlUpdateToLocation({ queryString, options }: UrlUpdateEvent): void {
	const href = `${window.location.pathname}${queryString}${window.location.hash}`;
	if (options.history === "push") {
		window.history.pushState(null, "", href);
		return;
	}
	window.history.replaceState(null, "", href);
}

/** `useUrlState` for tests, backed by the jsdom URL. A Testing Library wrapper, or part of an app's test providers. */
export function UrlStateTestProvider({ children }: UrlStateTestProviderProps): React.JSX.Element {
	// Re-render after every write and every Back / Forward, so the adapter is
	// handed the address bar as it is now; a changed one is what it syncs from.
	const [, rerender] = React.useReducer((count: number): number => count + 1, 0);
	const handleUrlUpdate = React.useCallback((event: UrlUpdateEvent): void => {
		writeUrlUpdateToLocation(event);
		rerender();
	}, []);
	React.useEffect((): (() => void) => {
		window.addEventListener("popstate", rerender);
		return (): void => {
			window.removeEventListener("popstate", rerender);
		};
	}, []);
	return (
		<NuqsTestingAdapter hasMemory searchParams={window.location.search} onUrlUpdate={handleUrlUpdate}>
			{children}
		</NuqsTestingAdapter>
	);
}
