// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Gantt, useGanttState } from "./gantt";
import { cancelActiveGanttGestures, commitKeyboardGesture, GANTT_ACTIVATION, isSegmentDraggable, isSegmentResizable, markGestureEnd, wasRecentDrag } from "./gantt-dnd";
import type { GanttInstance } from "./gantt-store";
import type { GanttDragKind, GanttEvent, GanttOccurrence, GanttOverlapPolicy, GanttProposedUpdate, GanttSegment, GanttUpdateResult } from "./gantt-types";
import { GanttTestProviders, stubGanttBrowserApis, TEST_CLOCK, TEST_TIME_ZONE, utc } from "@workspace/ui/testing/gantt-testing";
import { GanttView } from "./gantt-view";

const FIRST: GanttEvent = { id: "a", title: "Alpha", start: utc(2026, 2, 9), end: utc(2026, 2, 10), allDay: true, resourceId: "r" };
const SECOND: GanttEvent = { id: "b", title: "Beta", start: utc(2026, 2, 11), end: utc(2026, 2, 12), allDay: true, resourceId: "r" };

beforeEach((): void => {
	stubGanttBrowserApis();
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

interface InstanceOptions {
	readonly overlap?: GanttOverlapPolicy;
	readonly enforceCanDrop?: boolean;
	readonly canDropEvent?: (update: GanttProposedUpdate) => boolean;
	readonly onEventUpdate?: (update: GanttProposedUpdate) => GanttUpdateResult;
	readonly readOnly?: boolean;
}

function useInstance(options: InstanceOptions): GanttInstance {
	return useGanttState({
		defaultEvents: [{ ...FIRST, readOnly: options.readOnly }, SECOND],
		resources: [{ id: "r", title: "Row" }],
		defaultScale: "week",
		defaultDate: utc(2026, 2, 10),
		timeZone: TEST_TIME_ZONE,
		clock: TEST_CLOCK,
		overlap: options.overlap,
		enforceCanDrop: options.enforceCanDrop,
		canDropEvent: options.canDropEvent,
		onEventUpdate: options.onEventUpdate,
	});
}

function instanceWith(options: InstanceOptions = {}): GanttInstance {
	return renderHook((): GanttInstance => useInstance(options), { wrapper: GanttTestProviders }).result.current;
}

function occurrenceOf(instance: GanttInstance, id: string): GanttOccurrence {
	const found = instance.api.getOccurrences().find((occurrence: GanttOccurrence): boolean => occurrence.eventId === id);
	if (found === undefined) {
		throw new Error(`missing occurrence ${id}`);
	}
	return found;
}

function segmentOf(occurrence: GanttOccurrence): GanttSegment {
	return { occurrence, day: occurrence.start, isStart: true, isEnd: true, continuesBefore: false, continuesAfter: false };
}

/** One forward keyboard step on `id`, flushed through React. */
function commitInAct(instance: GanttInstance, id: string, kind: GanttDragKind): boolean {
	let accepted = false;
	act((): void => {
		accepted = commitKeyboardGesture({ instance, occurrence: occurrenceOf(instance, id), intent: { kind, direction: 1 } });
	});
	return accepted;
}

describe("commitKeyboardGesture", (): void => {
	it("commits a move through onEventUpdate", (): void => {
		const instance = instanceWith();
		expect(commitInAct(instance, "a", "move")).toBe(true);
		expect(instance.api.getEvent("a")?.start.getTime()).toBe(utc(2026, 2, 10).getTime());
	});

	it("rejects an overlapping step under the reject policy", (): void => {
		const instance = instanceWith({ overlap: "reject" });
		expect(commitInAct(instance, "a", "resize-end")).toBe(true);
		expect(commitInAct(instance, "a", "resize-end")).toBe(false);
	});

	it("honours an enforced canDropEvent veto and a consumer rejection", (): void => {
		const vetoed = instanceWith({ enforceCanDrop: true, canDropEvent: (): boolean => false });
		expect(commitKeyboardGesture({ instance: vetoed, occurrence: occurrenceOf(vetoed, "a"), intent: { kind: "move", direction: -1 } })).toBe(false);
		const rejected = instanceWith({ onEventUpdate: (): GanttUpdateResult => false });
		expect(commitKeyboardGesture({ instance: rejected, occurrence: occurrenceOf(rejected, "a"), intent: { kind: "move", direction: -1 } })).toBe(false);
		expect(rejected.api.getEvent("a")?.start.getTime()).toBe(FIRST.start.getTime());
	});

	it("refuses a step that would collapse the bar", (): void => {
		const instance = instanceWith();
		expect(commitKeyboardGesture({ instance, occurrence: occurrenceOf(instance, "a"), intent: { kind: "resize-end", direction: -1 } })).toBe(false);
	});
});

describe("gesture permissions", (): void => {
	it("ANDs interactions with per-event vetoes", (): void => {
		const instance = instanceWith({ readOnly: true });
		expect(isSegmentDraggable(instance, segmentOf(occurrenceOf(instance, "a")))).toBe(false);
		expect(isSegmentResizable(instance, segmentOf(occurrenceOf(instance, "a")))).toBe(false);
		expect(isSegmentDraggable(instance, segmentOf(occurrenceOf(instance, "b")))).toBe(true);
		act((): void => {
			instance.api.setInteractions({ drag: false });
		});
		expect(isSegmentDraggable(instance, segmentOf(occurrenceOf(instance, "b")))).toBe(false);
	});

	it("remembers a just-ended gesture so its click is ignored", (): void => {
		markGestureEnd();
		expect(wasRecentDrag()).toBe(true);
		expect(GANTT_ACTIVATION.moveDistancePx).toBeGreaterThan(GANTT_ACTIVATION.createDistancePx);
		cancelActiveGanttGestures();
	});
});

interface DragHarnessProps {
	readonly onEventUpdate: (update: GanttProposedUpdate) => GanttUpdateResult;
}

function DragHarness({ onEventUpdate }: DragHarnessProps): React.JSX.Element {
	return (
		<Gantt
			defaultEvents={[FIRST, SECOND]}
			resources={[{ id: "r", title: "Row" }]}
			defaultScale="week"
			defaultDate={utc(2026, 2, 10)}
			timeZone={TEST_TIME_ZONE}
			clock={TEST_CLOCK}
			infiniteScroll={false}
			onEventUpdate={onEventUpdate}>
			<GanttView />
		</Gantt>
	);
}

/** One week on a 700px axis: 100px per day, from Sun Mar 8. */
const AXIS_RECT = DOMRect.fromRect({ x: 0, y: 0, width: 700, height: 32 });

describe("pointer gestures", (): void => {
	it("moves a bar by whole days and commits on release", (): void => {
		const onEventUpdate = vi.fn((_update: GanttProposedUpdate): GanttUpdateResult => undefined);
		render(<DragHarness onEventUpdate={onEventUpdate} />, { wrapper: GanttTestProviders });
		const axis = document.querySelector<HTMLElement>("[data-gantt-axis]");
		if (axis === null) {
			throw new Error("axis missing");
		}
		vi.spyOn(axis, "getBoundingClientRect").mockReturnValue(AXIS_RECT);
		const bar = screen.getByRole("button", { name: /Alpha/ });
		act((): void => {
			fireEvent.pointerDown(bar, { pointerId: 1, button: 0, clientX: 150, clientY: 10, pointerType: "mouse" });
			fireEvent.pointerMove(window, { pointerId: 1, clientX: 350, clientY: 10 });
		});
		expect(document.querySelector("[data-slot=gantt-drag-ghost]")).not.toBeNull();
		act((): void => {
			fireEvent.pointerUp(window, { pointerId: 1, clientX: 350, clientY: 10 });
		});
		const update = onEventUpdate.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first];
		expect(update?.source).toBe("drag");
		expect(update?.start.toISOString()).toBe(utc(2026, 2, 11).toISOString());
		expect(update?.end.toISOString()).toBe(utc(2026, 2, 12).toISOString());
		expect(document.querySelector("[data-slot=gantt-drag-overlay]")).toBeNull();
	});

	it("treats a sub-threshold press as a click", (): void => {
		const onEventUpdate = vi.fn((_update: GanttProposedUpdate): GanttUpdateResult => undefined);
		render(<DragHarness onEventUpdate={onEventUpdate} />, { wrapper: GanttTestProviders });
		const bar = screen.getByRole("button", { name: /Alpha/ });
		act((): void => {
			fireEvent.pointerDown(bar, { pointerId: 1, button: 0, clientX: 150, clientY: 10, pointerType: "mouse" });
			fireEvent.pointerMove(window, { pointerId: 1, clientX: 152, clientY: 10 });
			fireEvent.pointerUp(window, { pointerId: 1, clientX: 152, clientY: 10 });
		});
		expect(onEventUpdate).not.toHaveBeenCalled();
	});
});
