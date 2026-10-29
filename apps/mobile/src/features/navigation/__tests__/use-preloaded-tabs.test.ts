import type { AppRoute } from "../../../runtime/routes";
import { APP_TABS } from "../app-tabs";
import { preloadTabsWhenIdle, type TabPreloader } from "../use-preloaded-tabs";

interface FakePreloader extends TabPreloader {
	readonly prefetched: AppRoute[];
	readonly cancelled: number[];
	/** Runs the next idle callback; `false` when none is waiting. */
	readonly idle: () => boolean;
}

function fakePreloader(): FakePreloader {
	const prefetched: AppRoute[] = [];
	const cancelled: number[] = [];
	const waiting: (() => void)[] = [];
	return {
		prefetched,
		cancelled,
		prefetch: (route: AppRoute): void => {
			prefetched.push(route);
		},
		requestIdle: (callback: () => void): number => {
			waiting.push(callback);
			return waiting.length;
		},
		cancelIdle: (handle: number): void => {
			cancelled.push(handle);
		},
		idle: (): boolean => {
			const next = waiting.shift();
			next?.();
			return next !== undefined;
		},
	};
}

describe("preloadTabsWhenIdle", () => {
	it("preloads one tab per idle callback, in the tab bar's order, and then stops", () => {
		const preloader = fakePreloader();
		preloadTabsWhenIdle(APP_TABS, preloader);

		expect(preloader.prefetched).toEqual([]);
		preloader.idle();
		expect(preloader.prefetched).toEqual([APP_TABS.at(0)?.route]);
		while (preloader.idle()) {
			// Drain the remaining idle callbacks.
		}
		expect(preloader.prefetched).toEqual(APP_TABS.map((tab) => tab.route));
	});

	it("cancels the pending idle callback when the tab bar goes away", () => {
		const preloader = fakePreloader();
		const stop = preloadTabsWhenIdle(APP_TABS, preloader);

		stop();

		expect(preloader.cancelled).toHaveLength(1);
	});
});
