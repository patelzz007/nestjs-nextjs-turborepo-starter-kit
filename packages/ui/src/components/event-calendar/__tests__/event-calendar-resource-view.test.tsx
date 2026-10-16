// @vitest-environment jsdom
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EventCalendarResourceView } from "../event-calendar-resource-view";
import { CalendarHarness, ResizeObserverStub, testRect, type TestEventData } from "@workspace/ui/testing/event-calendar-test-harness";
import type { CalendarEvent, EventCalendarProposedUpdate, EventCalendarResource, EventCalendarSlotInfo, EventCalendarUpdateResult } from "../event-calendar-types";

const RESOURCES: readonly EventCalendarResource[] = [
	{
		id: "floor",
		title: "Floor",
		children: [
			{ id: "a", title: "Room A" },
			{ id: "b", title: "Room B" },
		],
	},
];
const EVENTS: readonly CalendarEvent<TestEventData>[] = [
	{ id: "a1", title: "In A", start: new Date("2026-03-16T09:00:00Z"), end: new Date("2026-03-16T10:00:00Z"), resourceId: "a" },
	{ id: "b1", title: "In B", start: new Date("2026-03-16T09:00:00Z"), end: new Date("2026-03-16T10:00:00Z"), resourceId: "b" },
	{ id: "b2", title: "B all day", start: new Date("2026-03-16T00:00:00Z"), end: new Date("2026-03-17T00:00:00Z"), allDay: true, resourceId: "b" },
];
const DATE = new Date("2026-03-16T08:00:00Z");

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach((): void => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function acceptUpdate(): EventCalendarUpdateResult {
	return true;
}

function resourceColumns(): HTMLElement[] {
	return [...document.querySelectorAll<HTMLElement>("[data-slot=event-calendar-day-column]")];
}

describe("EventCalendarResourceView", () => {
	it("renders a booking column per leaf resource with its own events and a forwarded ref", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(
			<CalendarHarness view="resource" date={DATE} events={EVENTS} resources={RESOURCES}>
				<EventCalendarResourceView ref={ref} className="custom-resources" />
			</CalendarHarness>,
		);
		const grid = screen.getByRole("grid", { name: "Resources" });
		expect(grid).toBe(ref.current);
		expect(grid.className.split(" ").at(-1)).toBe("custom-resources");
		expect(
			within(grid)
				.getAllByRole("columnheader")
				.map((header: HTMLElement): string => header.textContent),
		).toEqual(["Room A", "Room B"]);
		const [roomA, roomB] = resourceColumns();
		expect(roomA?.dataset.ecResource).toBe("a");
		expect(within(roomA ?? grid).getByRole("button", { name: /^In A/ })).toBeTruthy();
		expect(within(roomB ?? grid).getByRole("button", { name: /^In B/ })).toBeTruthy();
		const allDayCells = [...document.querySelectorAll<HTMLElement>("[data-slot=event-calendar-all-day-cell]")];
		expect(within(allDayCells.at(1) ?? grid).getByRole("button", { name: /^B all day/ })).toBeTruthy();
	});

	it("creates in the focused resource column with Enter", (): void => {
		const onSlotClick = vi.fn<(slot: EventCalendarSlotInfo) => void>();
		render(
			<CalendarHarness view="resource" date={DATE} events={EVENTS} resources={RESOURCES} onSlotClick={onSlotClick}>
				<EventCalendarResourceView />
			</CalendarHarness>,
		);
		const [roomA] = resourceColumns();
		if (roomA === undefined) {
			throw new Error("missing column");
		}
		act((): void => {
			roomA.focus();
		});
		fireEvent.keyDown(roomA, { key: "ArrowRight" });
		const focused = document.activeElement;
		if (!(focused instanceof HTMLElement)) {
			throw new Error("no focus");
		}
		expect(focused.dataset.ecResource).toBe("b");
		fireEvent.keyDown(focused, { key: "Enter" });
		expect(onSlotClick.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]).toMatchObject({ resourceId: "b", view: "resource", allDay: false });
	});

	it("proposes the target resource when an event is dragged across columns", (): void => {
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function stubRect(this: Element): DOMRect {
			if (!(this instanceof HTMLElement) || this.dataset.slot !== "event-calendar-day-column") {
				return testRect(0, 0, 0, 0);
			}
			return testRect(resourceColumns().indexOf(this) * 100, 0, 100, 1440);
		});
		const onEventUpdate = vi.fn<(update: EventCalendarProposedUpdate) => EventCalendarUpdateResult>(acceptUpdate);
		const onEventsChange = vi.fn<(events: CalendarEvent<TestEventData>[]) => void>();
		render(
			<CalendarHarness view="resource" date={DATE} events={EVENTS} resources={RESOURCES} onEventUpdate={onEventUpdate} onEventsChange={onEventsChange}>
				<EventCalendarResourceView />
			</CalendarHarness>,
		);
		fireEvent.pointerDown(screen.getByRole("button", { name: /^In A/ }), { pointerId: 1, button: 0, clientX: 50, clientY: 540 });
		fireEvent.pointerMove(window, { pointerId: 1, clientX: 150, clientY: 540 });
		fireEvent.pointerUp(window, { pointerId: 1 });
		expect(onEventUpdate.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]).toMatchObject({ resourceId: "b", start: new Date("2026-03-16T09:00:00Z") });
		expect(
			onEventsChange.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]?.find((event: CalendarEvent<TestEventData>): boolean => event.id === "a1")?.resourceId,
		).toBe("b");
	});
});
