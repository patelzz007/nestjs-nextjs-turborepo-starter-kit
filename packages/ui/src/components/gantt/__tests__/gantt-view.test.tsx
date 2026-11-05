// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Gantt } from "../gantt";
import { GanttNav } from "../gantt-nav";
import type { GanttEvent, GanttProposedUpdate, GanttResourceReorder, GanttUpdateResult } from "../gantt-types";
import { GanttTestProviders, stubGanttBrowserApis, TEST_CLOCK, TEST_EVENTS, TEST_RESOURCES, TEST_TIME_ZONE, utc } from "@workspace/ui/testing/gantt-testing";
import { GanttView } from "../gantt-view";

const ANCHOR = utc(2026, 2, 10);

beforeEach((): void => {
	stubGanttBrowserApis();
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

interface HarnessProps {
	readonly events?: readonly GanttEvent[];
	readonly onEventUpdate?: (update: GanttProposedUpdate) => GanttUpdateResult;
	readonly onResourceReorder?: (proposal: GanttResourceReorder) => false | undefined;
	readonly viewRef?: React.Ref<HTMLDivElement>;
	readonly className?: string;
	readonly rowVirtualization?: { readonly threshold: number; readonly overscanRows: number };
}

function Harness({ events = TEST_EVENTS, onEventUpdate, onResourceReorder, viewRef, className, rowVirtualization }: HarnessProps): React.JSX.Element {
	return (
		<Gantt
			defaultEvents={events}
			resources={TEST_RESOURCES}
			defaultScale="week"
			defaultDate={ANCHOR}
			timeZone={TEST_TIME_ZONE}
			clock={TEST_CLOCK}
			infiniteScroll={false}
			onEventUpdate={onEventUpdate}
			onResourceReorder={onResourceReorder}
			rowVirtualization={rowVirtualization}>
			<GanttNav />
			<GanttView ref={viewRef} className={className} />
		</Gantt>
	);
}

function renderHarness(props: HarnessProps = {}): ReturnType<typeof render> {
	return render(<Harness {...props} />, { wrapper: GanttTestProviders });
}

describe("GanttView", (): void => {
	it("renders the tree, the week axis and a bar per event", (): void => {
		renderHarness();
		expect(screen.getByRole("region", { name: "Resources" })).toBeTruthy();
		expect(screen.getByRole("region", { name: "Timeline" })).toBeTruthy();
		const tree = screen.getByRole("tree", { name: "Resources" });
		expect(
			within(tree)
				.getAllByRole("treeitem")
				.map((item: HTMLElement): string | null => item.getAttribute("aria-label")),
		).toEqual(["Design", "Wireframes", "Visuals", "Build"]);
		const axis = document.querySelector<HTMLElement>("[data-gantt-axis]");
		expect(axis?.dataset.ganttRangeStart).toBe(String(utc(2026, 2, 8).getTime()));
		expect(axis?.dataset.ganttRangeEnd).toBe(String(utc(2026, 2, 15).getTime()));
		expect(document.querySelectorAll("[data-slot=gantt-bar]")).toHaveLength(TEST_EVENTS.length);
		expect(screen.getByRole("button", { name: /Sketch flows/ }).getAttribute("data-progress")).toBe("50");
	});

	it("marks today on the axis from the injected clock", (): void => {
		renderHarness();
		const today = document.querySelector("[data-gantt-axis] [data-today]");
		expect(today?.textContent).toBe("Tue 10");
	});

	it("draws a dependency arrow and the milestone diamond", (): void => {
		renderHarness();
		expect(document.querySelectorAll("[data-slot=gantt-dependency]")).toHaveLength(1);
		expect(screen.getByRole("button", { name: /Ship/ }).getAttribute("data-milestone")).toBe("");
	});

	it("collapses and expands a group", (): void => {
		renderHarness();
		const toggle = screen.getByRole("button", { name: "Design", expanded: true });
		fireEvent.click(toggle);
		expect(screen.queryByRole("treeitem", { name: "Wireframes" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Design", expanded: false }));
		expect(screen.getByRole("treeitem", { name: "Wireframes" })).toBeTruthy();
	});

	it("moves a focused bar one day with the arrow keys and announces it", (): void => {
		const onEventUpdate = vi.fn((_update: GanttProposedUpdate): GanttUpdateResult => undefined);
		renderHarness({ onEventUpdate });
		const bar = screen.getByRole("button", { name: /Sketch flows/ });
		fireEvent.keyDown(bar, { key: "ArrowRight" });
		const update = onEventUpdate.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first];
		expect(update?.source).toBe("keyboard");
		expect(update?.start.toISOString()).toBe(utc(2026, 2, 10).toISOString());
		expect(update?.end.toISOString()).toBe(utc(2026, 2, 12).toISOString());
		expect(document.querySelector("[data-slot=gantt-announcer]")?.textContent).toContain("Sketch flows");
	});

	it("resizes the end with Shift + arrow and reverts when the consumer rejects", (): void => {
		const onEventUpdate = vi.fn((_update: GanttProposedUpdate): GanttUpdateResult => false);
		renderHarness({ onEventUpdate });
		const bar = screen.getByRole("button", { name: /Sketch flows/ });
		fireEvent.keyDown(bar, { key: "ArrowRight", shiftKey: true });
		const update = onEventUpdate.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first];
		expect(update?.start.toISOString()).toBe(utc(2026, 2, 9).toISOString());
		expect(update?.end.toISOString()).toBe(utc(2026, 2, 12).toISOString());
		expect(document.querySelector("[data-slot=gantt-announcer]")?.textContent).toBe("");
	});

	it("selects a bar on click", (): void => {
		renderHarness();
		const bar = screen.getByRole("button", { name: /Palette/ });
		fireEvent.click(bar);
		expect(bar.getAttribute("aria-pressed")).toBe("true");
	});

	it("resizes the tree pane from the keyboard splitter", (): void => {
		renderHarness();
		const splitter = screen.getByRole("slider", { name: "Resize panel" });
		const before = Number(splitter.getAttribute("aria-valuenow"));
		fireEvent.keyDown(splitter, { key: "ArrowRight" });
		expect(Number(splitter.getAttribute("aria-valuenow"))).toBeGreaterThan(before);
	});

	it("navigates with the nav and re-anchors the axis", (): void => {
		renderHarness();
		fireEvent.click(screen.getByRole("button", { name: "Next" }));
		expect(document.querySelector<HTMLElement>("[data-gantt-axis]")?.dataset.ganttRangeStart).toBe(String(utc(2026, 2, 15).getTime()));
	});

	it("offers the reorder grip only when reordering is wired", (): void => {
		const onResourceReorder = vi.fn((): undefined => undefined);
		renderHarness({ onResourceReorder });
		expect(screen.getAllByRole("button", { name: "Reorder" })).toHaveLength(TEST_RESOURCES.length + 2);
	});

	it("windows rows past the virtualization threshold", (): void => {
		renderHarness({ rowVirtualization: { threshold: 0, overscanRows: 0 } });
		// jsdom has no layout: an empty viewport still renders the first row
		expect(screen.getAllByRole("treeitem").length).toBeLessThan(TEST_RESOURCES.length + 2);
	});

	it("forwards its ref and merges className last", (): void => {
		const viewRef = React.createRef<HTMLDivElement>();
		renderHarness({ viewRef, className: "custom-view" });
		expect(viewRef.current?.getAttribute("data-slot")).toBe("gantt-view");
		expect(viewRef.current?.className).toContain("custom-view");
	});

	it("shows the loading status", (): void => {
		render(
			<Gantt events={TEST_EVENTS} resources={TEST_RESOURCES} loading clock={TEST_CLOCK} timeZone={TEST_TIME_ZONE}>
				<GanttView />
			</Gantt>,
			{ wrapper: GanttTestProviders },
		);
		expect(screen.getByRole("status").textContent).toBe("Loading events");
	});

	it("keeps rendering after a pointer drag is cancelled with Escape", (): void => {
		renderHarness();
		const bar = screen.getByRole("button", { name: /Palette/ });
		act((): void => {
			fireEvent.pointerDown(bar, { pointerId: 1, button: 0, clientX: 10, clientY: 10, pointerType: "mouse" });
			fireEvent.pointerMove(window, { pointerId: 1, clientX: 60, clientY: 10 });
			fireEvent.keyDown(window, { key: "Escape" });
		});
		expect(document.querySelector("[data-slot=gantt-drag-ghost]")).toBeNull();
		expect(document.body.classList.contains("gantt-dragging")).toBe(false);
	});

	describe("centring the target until the user scrolls", (): void => {
		/** A ResizeObserver a test fires, as the browser does when an observed box changes size; a disconnected one stays quiet. */
		const observers: RecordingResizeObserver[] = [];
		class RecordingResizeObserver {
			public connected = true;
			public readonly targets = new Set<Element>();
			public constructor(public readonly callback: () => void) {
				observers.push(this);
			}
			public observe(target: Element): void {
				this.targets.add(target);
			}
			public unobserve(target: Element): void {
				this.targets.delete(target);
			}
			public disconnect(): void {
				this.connected = false;
				this.targets.clear();
			}
		}

		/** The timeline pane's scrolling viewport, as the view itself finds it. */
		function timelineViewport(): HTMLElement {
			const viewport = screen.getByRole("region", { name: "Timeline" }).querySelector<HTMLElement>("[data-slot=scroll-area-viewport]");
			if (viewport === null) {
				throw new Error("the timeline has no scrolling viewport");
			}
			return viewport;
		}

		/**
		 * Gives the timeline a laid-out size (jsdom has no layout): the pane's visible width, the axis's own width, and
		 * the scrolled width (the axis plus anything overflowing past its end). Then tells every observer.
		 */
		function resizeTimeline(viewport: HTMLElement, size: { readonly clientWidth: number; readonly axisWidth: number; readonly overflowPx?: number }): void {
			const axis = viewport.querySelector<HTMLElement>("[data-gantt-axis]");
			if (axis === null) {
				throw new Error("the timeline has no axis");
			}
			Object.defineProperty(viewport, "clientWidth", { configurable: true, value: size.clientWidth });
			Object.defineProperty(viewport, "scrollWidth", { configurable: true, value: size.axisWidth + (size.overflowPx ?? 0) });
			Object.defineProperty(axis, "offsetWidth", { configurable: true, value: size.axisWidth });
			act((): void => {
				for (const observer of observers.filter((candidate: RecordingResizeObserver): boolean => candidate.connected && candidate.targets.size > 0)) {
					observer.callback();
				}
			});
		}

		it("keeps the same instant at the centre as the pane changes size (fonts arriving, a sidebar folding)", (): void => {
			observers.length = 0;
			vi.stubGlobal("ResizeObserver", RecordingResizeObserver);
			renderHarness();
			const viewport = timelineViewport();

			resizeTimeline(viewport, { clientWidth: 400, axisWidth: 4000 });
			const centreWhenWide = viewport.scrollLeft + 400 / 2;
			resizeTimeline(viewport, { clientWidth: 300, axisWidth: 4000 });
			const centreWhenNarrow = viewport.scrollLeft + 300 / 2;

			expect(centreWhenWide).toBeGreaterThan(0);
			expect(centreWhenNarrow).toBe(centreWhenWide);
		});

		it("maps the centre onto the axis, not onto content overflowing past its end (a bar's label)", (): void => {
			observers.length = 0;
			vi.stubGlobal("ResizeObserver", RecordingResizeObserver);
			renderHarness();
			const viewport = timelineViewport();

			resizeTimeline(viewport, { clientWidth: 400, axisWidth: 4000 });
			const centred = viewport.scrollLeft;
			resizeTimeline(viewport, { clientWidth: 400, axisWidth: 4000, overflowPx: 33 });

			expect(viewport.scrollLeft).toBe(centred);
		});
	});
});
