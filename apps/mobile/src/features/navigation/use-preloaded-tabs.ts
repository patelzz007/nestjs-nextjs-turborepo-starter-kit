// Tabs mount lazily: a tab's screen is first rendered the moment it is first opened, during the tab
// transition, so the first switch to a heavy tab (Analytics' charts) stutters while every later one
// is smooth. This preloads every tab once the app is idle after the tabs appear — one tab per idle
// callback, so the first screen's own frames are never competed with — and the first switch then
// only animates an already-rendered screen (`router.prefetch`, React Navigation's `preload`).

import { useRouter } from "expo-router";
import * as React from "react";

import type { AppRoute } from "../../runtime/routes";
import { APP_TABS, type AppTab } from "./app-tabs";

/** What preloading needs: a way to prefetch a route, and the platform's idle callbacks. */
export interface TabPreloader {
	readonly prefetch: (route: AppRoute) => void;
	readonly requestIdle: (callback: () => void) => number;
	readonly cancelIdle: (handle: number) => void;
}

/** Preloads `tabs` one per idle callback, in order; returns how to stop (on unmount). */
export function preloadTabsWhenIdle(tabs: readonly AppTab[], preloader: TabPreloader): () => void {
	const pending: AppTab[] = [...tabs];
	let handle = preloader.requestIdle(preloadNext);

	function preloadNext(): void {
		const tab = pending.shift();
		if (tab === undefined) {
			return;
		}
		preloader.prefetch(tab.route);
		handle = preloader.requestIdle(preloadNext);
	}

	return (): void => {
		preloader.cancelIdle(handle);
	};
}

export function usePreloadedTabs(): void {
	const router = useRouter();

	React.useEffect(
		(): (() => void) =>
			preloadTabsWhenIdle(APP_TABS, {
				prefetch: (route: AppRoute): void => {
					router.prefetch(route);
				},
				requestIdle: (callback: () => void): number => requestIdleCallback(callback),
				cancelIdle: (handle: number): void => {
					cancelIdleCallback(handle);
				},
			}),
		[router],
	);
}
