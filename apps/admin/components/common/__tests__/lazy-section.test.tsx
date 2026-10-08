// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LazySection } from "@/components/common/lazy-section";

type ObserverCallback = (entries: readonly Pick<IntersectionObserverEntry, "isIntersecting">[]) => void;

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("LazySection", () => {
	it("keeps the skeleton until the section nears the viewport, then mounts the content", () => {
		const callbacks: ObserverCallback[] = [];
		const disconnect = vi.fn();
		vi.stubGlobal(
			"IntersectionObserver",
			vi.fn(function FakeObserver(callback: ObserverCallback) {
				callbacks.push(callback);
				return { observe: vi.fn(), disconnect };
			}),
		);

		render(
			<LazySection height="h-10">
				<p>Section body</p>
			</LazySection>,
		);
		expect(screen.queryByText("Section body")).toBeNull();

		act(() => {
			callbacks[LIST_SLOT_INDEX.first]?.([{ isIntersecting: true }]);
		});
		expect(screen.getByText("Section body")).toBeTruthy();
		expect(disconnect).toHaveBeenCalled();
	});

	it("shows the content without an animation-frame workaround when IntersectionObserver is unavailable", () => {
		vi.stubGlobal("IntersectionObserver", undefined);
		const requestFrame = vi.spyOn(window, "requestAnimationFrame");

		render(
			<LazySection height="h-10">
				<p>Section body</p>
			</LazySection>,
		);

		expect(screen.getByText("Section body")).toBeTruthy();
		expect(requestFrame).not.toHaveBeenCalled();
	});
});
