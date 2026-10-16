// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NEAR_VIEWPORT_MARGIN, useNearViewport } from "../use-near-viewport";

/** The observers the hook creates, so a test can report an intersection. */
const observers: StubObserver[] = [];

class StubObserver {
	public readonly observed: Element[] = [];
	public disconnected = false;

	/** The hook reads only `isIntersecting` from each entry. */
	public constructor(
		public readonly callback: (entries: readonly Pick<IntersectionObserverEntry, "isIntersecting">[]) => void,
		public readonly options: IntersectionObserverInit | undefined,
	) {
		observers.push(this);
	}

	public observe(element: Element): void {
		this.observed.push(element);
	}

	public disconnect(): void {
		this.disconnected = true;
	}
}

function latestObserver(): StubObserver {
	const observer = observers.at(-1);
	if (observer === undefined) {
		throw new Error("no observer was created");
	}
	return observer;
}

/** Reports whether the observed element intersects, through the hook's own callback. */
function report(observer: StubObserver, isIntersecting: boolean): void {
	act((): void => {
		observer.callback([{ isIntersecting }]);
	});
}

beforeEach((): void => {
	observers.length = 0;
	vi.stubGlobal("IntersectionObserver", StubObserver);
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("useNearViewport", () => {
	it("waits for the element to come near the viewport, then stays true and stops observing", () => {
		const element = document.createElement("div");
		const { result } = renderHook(() => useNearViewport(element));
		const observer = latestObserver();

		expect(result.current).toBe(false);
		expect(observer.options?.rootMargin).toBe(NEAR_VIEWPORT_MARGIN);
		expect(observer.observed).toEqual([element]);

		report(observer, false);
		expect(result.current).toBe(false);

		report(observer, true);
		expect(result.current).toBe(true);
		expect(observer.disconnected).toBe(true);
	});

	it("is true at once when eager, without observing", () => {
		const { result } = renderHook(() => useNearViewport(document.createElement("div"), true));

		expect(result.current).toBe(true);
		expect(observers).toHaveLength(0);
	});

	it("is false while there is no element yet", () => {
		const { result } = renderHook(() => useNearViewport(null));

		expect(result.current).toBe(false);
		expect(observers).toHaveLength(0);
	});
});
