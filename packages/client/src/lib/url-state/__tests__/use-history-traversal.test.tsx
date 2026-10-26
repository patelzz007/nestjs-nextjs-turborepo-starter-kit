// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useHistoryTraversalCount } from "../use-history-traversal";

/** A stand-in for `window.navigation` (jsdom has no Navigation API). */
function installNavigation(): EventTarget {
	const navigation = new EventTarget();
	Object.defineProperty(window, "navigation", { value: navigation, configurable: true });
	return navigation;
}

/** A `currententrychange` event of the given navigation type. */
function entryChange(navigationType: NavigationType): Event {
	const event = new Event("currententrychange");
	Object.defineProperty(event, "navigationType", { value: navigationType });
	return event;
}

afterEach((): void => {
	cleanup();
	Reflect.deleteProperty(window, "navigation");
});

describe("useHistoryTraversalCount", () => {
	it("counts Back / Forward through the Navigation API, and nothing else", () => {
		const navigation = installNavigation();
		const { result } = renderHook(() => useHistoryTraversalCount());
		expect(result.current).toBe(0);

		act((): void => {
			navigation.dispatchEvent(entryChange("push"));
			navigation.dispatchEvent(entryChange("replace"));
		});
		expect(result.current).toBe(0);

		act((): void => {
			navigation.dispatchEvent(entryChange("traverse"));
		});
		expect(result.current).toBe(1);
	});

	it("does not count popstate where the Navigation API is there (an in-page anchor click fires popstate too)", () => {
		installNavigation();
		const { result } = renderHook(() => useHistoryTraversalCount());

		act((): void => {
			window.dispatchEvent(new PopStateEvent("popstate"));
		});
		expect(result.current).toBe(0);
	});

	it("falls back to popstate without the Navigation API", () => {
		const { result } = renderHook(() => useHistoryTraversalCount());

		act((): void => {
			window.dispatchEvent(new PopStateEvent("popstate"));
			window.dispatchEvent(new PopStateEvent("popstate"));
		});
		expect(result.current).toBe(2);
	});

	it("stops listening once unmounted", () => {
		const navigation = installNavigation();
		const { result, unmount } = renderHook(() => useHistoryTraversalCount());
		unmount();

		navigation.dispatchEvent(entryChange("traverse"));
		expect(result.current).toBe(0);
	});
});
