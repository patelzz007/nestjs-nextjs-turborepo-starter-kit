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

		const { container } = render(
			<LazySection height="h-10">
				<p>Section body</p>
			</LazySection>,
		);
		expect(screen.queryByText("Section body")).toBeNull();
		// Section bones at the reserved height, hidden from assistive technology —
		// nothing is loading yet, so nothing is announced.
		const bones = container.querySelector('[data-skeleton="section"]');
		expect(bones?.classList.contains("h-10")).toBe(true);
		expect(bones?.closest('[aria-hidden="true"]')).not.toBeNull();
		expect(bones?.querySelector('[data-slot="skeleton"].skeleton-bone')).not.toBeNull();
		expect(screen.queryByRole("status")).toBeNull();
		expect(container.querySelector(".animate-pulse")).toBeNull();

		act(() => {
			callbacks[LIST_SLOT_INDEX.first]?.([{ isIntersecting: true }]);
		});
		expect(screen.getByText("Section body")).toBeTruthy();
		expect(container.querySelector('[data-skeleton="section"]')).toBeNull();
		expect(disconnect).toHaveBeenCalled();
	});

	it("draws a caller's static placeholder instead of the section bones until it mounts", () => {
		vi.stubGlobal(
			"IntersectionObserver",
			vi.fn(function OffscreenObserver() {
				return { observe: vi.fn(), disconnect: vi.fn() };
			}),
		);
		const { container } = render(
			<LazySection height="h-10" placeholder={<div data-testid="static-box" />}>
				<p>Section body</p>
			</LazySection>,
		);
		expect(screen.queryByText("Section body")).toBeNull();
		expect(screen.getByTestId("static-box").closest('[aria-hidden="true"]')).not.toBeNull();
		expect(container.querySelector('[data-skeleton="section"]')).toBeNull();
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
