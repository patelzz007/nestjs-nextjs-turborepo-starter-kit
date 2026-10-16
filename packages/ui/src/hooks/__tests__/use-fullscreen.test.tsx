// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFullscreen } from "../use-fullscreen";

/** jsdom has no Fullscreen API: a stand-in that tracks the element and fires the change event. */
const fullscreen: { element: Element | null } = { element: null };

function setFullscreenElement(element: Element | null): void {
	fullscreen.element = element;
	document.dispatchEvent(new Event("fullscreenchange"));
}

const exitFullscreen = vi.fn((): Promise<void> => {
	setFullscreenElement(null);
	return Promise.resolve();
});
const requestFullscreen = vi.fn(function requestFullscreen(this: HTMLElement): Promise<void> {
	setFullscreenElement(this);
	return Promise.resolve();
});

beforeEach(() => {
	Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
	Object.defineProperty(document, "fullscreenElement", { configurable: true, get: (): Element | null => fullscreen.element });
	document.exitFullscreen = exitFullscreen;
	HTMLElement.prototype.requestFullscreen = requestFullscreen;
});

afterEach(() => {
	cleanup();
	fullscreen.element = null;
	vi.clearAllMocks();
});

function renderFullscreen(element: HTMLElement | null): ReturnType<typeof renderHook<ReturnType<typeof useFullscreen>, undefined>> {
	return renderHook(() => {
		const ref = React.useRef<HTMLElement | null>(element);
		return useFullscreen(ref);
	});
}

describe("useFullscreen", () => {
	it("enters and leaves fullscreen with the element", async () => {
		const element = document.createElement("section");
		const { result } = renderFullscreen(element);
		expect(result.current).toMatchObject({ supported: true, active: false });
		await act(async () => {
			result.current.toggle();
			await Promise.resolve();
		});
		expect(requestFullscreen.mock.contexts).toEqual([element]);
		expect(result.current.active).toBe(true);
		await act(async () => {
			result.current.toggle();
			await Promise.resolve();
		});
		expect(exitFullscreen).toHaveBeenCalled();
		expect(result.current.active).toBe(false);
	});

	it("follows a change made outside the toggle (Esc), and ignores another element in fullscreen", () => {
		const element = document.createElement("section");
		const { result } = renderFullscreen(element);
		act(() => {
			setFullscreenElement(element);
		});
		expect(result.current.active).toBe(true);
		act(() => {
			setFullscreenElement(document.createElement("video"));
		});
		expect(result.current.active).toBe(false);
	});

	it("reports no support where the page may not go fullscreen", () => {
		Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: false });
		const { result } = renderFullscreen(document.createElement("section"));
		expect(result.current.supported).toBe(false);
	});

	it("does nothing without an element, and leaves the page as it was when the browser refuses", async () => {
		const { result: detached } = renderFullscreen(null);
		detached.current.toggle();
		expect(requestFullscreen).not.toHaveBeenCalled();

		requestFullscreen.mockImplementationOnce((): Promise<void> => Promise.reject(new TypeError("Permissions check failed")));
		const { result } = renderFullscreen(document.createElement("section"));
		await act(async () => {
			result.current.toggle();
			await Promise.resolve();
		});
		expect(result.current.active).toBe(false);
	});
});
