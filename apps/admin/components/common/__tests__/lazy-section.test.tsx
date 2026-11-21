// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LazySection, scrollParentOf } from "@/components/common/lazy-section";

type ObserverCallback = (entries: readonly Pick<IntersectionObserverEntry, "isIntersecting">[]) => void;

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

/** A chunk that is still downloading: it never settles within the test. */
const PENDING_CHUNK = new Promise<string>((): void => undefined);

function StillLoading(): React.JSX.Element {
	return <p>{React.use(PENDING_CHUNK)}</p>;
}

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

	it('keeps the content mounted by default, and with retain="near-viewport" unmounts it far away at its last height', () => {
		const callbacks: ObserverCallback[] = [];
		const latest = (): ObserverCallback | undefined => callbacks.at(callbacks.length - 1);
		vi.stubGlobal(
			"IntersectionObserver",
			vi.fn(function FakeObserver(callback: ObserverCallback) {
				callbacks.push(callback);
				return { observe: vi.fn(), disconnect: vi.fn() };
			}),
		);
		const heldHeightPx = 640;
		vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(heldHeightPx);

		const { container } = render(
			<LazySection height="h-10" commit="urgent" retain="near-viewport" placeholder={<div data-testid="static-box" />}>
				<p>Section body</p>
			</LazySection>,
		);
		act(() => {
			latest()?.([{ isIntersecting: true }]);
		});
		expect(screen.getByText("Section body")).toBeTruthy();

		act(() => {
			latest()?.([{ isIntersecting: false }]);
		});
		expect(screen.queryByText("Section body")).toBeNull();
		expect(screen.queryByTestId("static-box")).toBeNull();
		const held = container.querySelector<HTMLElement>("[data-lazy-section-held]");
		expect(held?.style.height).toBe(`${String(heldHeightPx)}px`);
		expect(held?.getAttribute("aria-hidden")).toBe("true");

		act(() => {
			latest()?.([{ isIntersecting: true }]);
		});
		expect(screen.getByText("Section body")).toBeTruthy();
		vi.restoreAllMocks();
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

	it('animates the reveal by default and shows the content as is with reveal="instant"', () => {
		vi.stubGlobal("IntersectionObserver", undefined);

		render(
			<>
				<LazySection height="h-10">
					<p>Animated body</p>
				</LazySection>
				<LazySection height="h-10" reveal="instant">
					<p>Instant body</p>
				</LazySection>
			</>,
		);

		expect(screen.getByText("Animated body").parentElement?.classList.contains("animate-in")).toBe(true);
		expect(screen.getByText("Instant body").parentElement?.classList.contains("animate-in")).toBe(false);
	});

	it("shows a still-loading section's own fallback when urgent, but keeps the placeholder in a transition", () => {
		const callbacks: ObserverCallback[] = [];
		vi.stubGlobal(
			"IntersectionObserver",
			vi.fn(function FakeObserver(callback: ObserverCallback) {
				callbacks.push(callback);
				return { observe: vi.fn(), disconnect: vi.fn() };
			}),
		);
		render(
			<>
				<LazySection height="h-10" commit="urgent" placeholder={<div data-testid="urgent-placeholder" />}>
					<React.Suspense fallback={<p>Urgent part loading</p>}>
						<StillLoading />
					</React.Suspense>
				</LazySection>
				<LazySection height="h-10" placeholder={<div data-testid="transition-placeholder" />}>
					<React.Suspense fallback={<p>Transition part loading</p>}>
						<StillLoading />
					</React.Suspense>
				</LazySection>
			</>,
		);

		act(() => {
			for (const callback of callbacks) {
				callback([{ isIntersecting: true }]);
			}
		});

		expect(screen.getByText("Urgent part loading")).toBeTruthy();
		expect(screen.queryByTestId("urgent-placeholder")).toBeNull();
		expect(screen.getByTestId("transition-placeholder")).toBeTruthy();
		expect(screen.queryByText("Transition part loading")).toBeNull();
	});

	it("measures against the element it scrolls inside, so its margin holds inside a scrolling panel", () => {
		const roots: (Element | Document | null | undefined)[] = [];
		vi.stubGlobal(
			"IntersectionObserver",
			vi.fn(function RootRecordingObserver(_callback: ObserverCallback, options?: IntersectionObserverInit) {
				roots.push(options?.root);
				return { observe: vi.fn(), disconnect: vi.fn() };
			}),
		);
		render(
			<main data-testid="scroller" style={{ overflowY: "auto" }}>
				<div>
					<LazySection height="h-10">
						<p>Section body</p>
					</LazySection>
				</div>
			</main>,
		);
		expect(roots).toEqual([screen.getByTestId("scroller")]);
	});

	it("finds the nearest scrolling ancestor, or the document when there is none", () => {
		const { container } = render(
			<div style={{ overflowY: "scroll" }} data-testid="outer">
				<div style={{ overflowY: "hidden" }}>
					<span data-testid="leaf" />
				</div>
			</div>,
		);
		expect(scrollParentOf(screen.getByTestId("leaf"))).toBe(screen.getByTestId("outer"));
		expect(scrollParentOf(screen.getByTestId("outer"))).toBeNull();
		expect(container.childElementCount).toBe(1);
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
