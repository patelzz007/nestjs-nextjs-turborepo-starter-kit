// @vitest-environment jsdom
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CalendarHarness, ResizeObserverStub, testRect } from "@workspace/ui/testing/event-calendar-test-harness";
import { EventCalendarDaysView, EventCalendarDayView, EventCalendarWeekView, minuteBlockStyle } from "../event-calendar-time-grid";
import type { EventCalendarProposedUpdate, EventCalendarSlotDraft, EventCalendarSlotInfo, EventCalendarUpdateResult } from "../event-calendar-types";

const COLUMN_WIDTH_PX = 100;
/** 1px per minute: a full-day column is 1440px tall. */
const COLUMN_HEIGHT_PX = 1440;

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

function column(name: string): HTMLElement {
	return screen.getByRole("gridcell", { name });
}

/** Lays the day columns out side by side, one pixel per minute. */
function stubColumnLayout(): void {
	vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function stubRect(this: Element): DOMRect {
		if (!(this instanceof HTMLElement) || this.dataset.slot !== "event-calendar-day-column") {
			return testRect(0, 0, 0, 0);
		}
		const columns = [...document.querySelectorAll("[data-slot=event-calendar-day-column]")];
		return testRect(columns.indexOf(this) * COLUMN_WIDTH_PX, 0, COLUMN_WIDTH_PX, COLUMN_HEIGHT_PX);
	});
}

describe("minuteBlockStyle", () => {
	it("positions a block in hour units with a minimum height", (): void => {
		expect(minuteBlockStyle(540, 600, 480)).toEqual({ top: "calc(var(--ec-hour-height) * 1)", height: "calc(var(--ec-hour-height) * 1)" });
		expect(minuteBlockStyle(540, 541, 0).height).toBe("calc(var(--ec-hour-height) * 0.25)");
	});
});

describe("EventCalendarWeekView", () => {
	it("renders a column per day, packed overlapping blocks, all-day bars and the now line", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(
			<CalendarHarness view="week">
				<EventCalendarWeekView ref={ref} className="custom-grid" />
			</CalendarHarness>,
		);
		const grid = screen.getByRole("grid");
		expect(grid).toBe(ref.current);
		expect(grid.className.split(" ").at(-1)).toBe("custom-grid");
		expect(grid.querySelectorAll("[data-slot=event-calendar-day-column]")).toHaveLength(7);
		expect(
			within(grid)
				.getAllByRole("columnheader")
				.map((header: HTMLElement): string => header.textContent),
		).toEqual(["Sun 15", "Mon 16", "Tue 17", "Wed 18", "Thu 19", "Fri 20", "Sat 21"]);
		const monday = column("Monday, March 16th, 2026");
		const blocks = monday.querySelectorAll<HTMLElement>("[data-slot=event-calendar-timed-block]");
		expect(blocks).toHaveLength(2);
		expect(blocks.item(LIST_SLOT_INDEX.first).getAttribute("style")).toContain("* 0.5");
		expect(screen.getByRole("button", { name: "Offsite, All day" }).dataset.variant).toBe("bar");
		expect(document.querySelector("[data-slot=event-calendar-now-indicator]")).not.toBeNull();
	});

	it("hides the weekend columns when the weekends setting is off", (): void => {
		render(
			<CalendarHarness view="week" viewSettings={{ weekends: false }}>
				<EventCalendarWeekView />
			</CalendarHarness>,
		);
		expect(screen.getAllByRole("columnheader").map((header: HTMLElement): string => header.textContent)).toEqual(["Mon 16", "Tue 17", "Wed 18", "Thu 19", "Fri 20"]);
	});

	it("navigates columns and a slot cursor by keyboard and creates with Enter", (): void => {
		const onSlotClick = vi.fn<(slot: EventCalendarSlotInfo) => void>();
		const onDateChange = vi.fn<(date: Date) => void>();
		render(
			<CalendarHarness view="week" onSlotClick={onSlotClick} onDateChange={onDateChange}>
				<EventCalendarWeekView />
			</CalendarHarness>,
		);
		const sunday = column("Sunday, March 15th, 2026");
		expect(sunday.tabIndex).toBe(0);
		act((): void => {
			sunday.focus();
		});
		fireEvent.keyDown(sunday, { key: "ArrowRight" });
		const monday = column("Monday, March 16th, 2026");
		expect(document.activeElement).toBe(monday);
		fireEvent.keyDown(monday, { key: "ArrowDown" });
		expect(document.querySelector("[data-slot=event-calendar-announcer]")?.textContent).toBe("7:30 AM – 8:00 AM");
		fireEvent.keyDown(monday, { key: "Enter" });
		expect(onSlotClick.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]).toEqual({
			date: new Date("2026-03-16T07:30:00Z"),
			end: new Date("2026-03-16T08:00:00Z"),
			allDay: false,
			view: "week",
		});
		fireEvent.keyDown(monday, { key: "PageDown" });
		expect(onDateChange.mock.calls.at(-1)?.[LIST_SLOT_INDEX.first]?.getTime()).toBe(Date.UTC(2026, 2, 22, 10));
	});

	it("moves and resizes a focused block with Alt(+Shift)+Arrow in snap steps", (): void => {
		const onEventUpdate = vi.fn<(update: EventCalendarProposedUpdate) => EventCalendarUpdateResult>(acceptUpdate);
		render(
			<CalendarHarness view="week" onEventUpdate={onEventUpdate}>
				<EventCalendarWeekView />
			</CalendarHarness>,
		);
		fireEvent.keyDown(screen.getByRole("button", { name: /^Standup/ }), { key: "ArrowDown", altKey: true });
		expect(onEventUpdate.mock.calls.at(-1)?.[LIST_SLOT_INDEX.first]).toMatchObject({ start: new Date("2026-03-16T09:15:00Z"), end: new Date("2026-03-16T09:45:00Z") });
		fireEvent.keyDown(screen.getByRole("button", { name: /^Standup/ }), { key: "ArrowDown", altKey: true, shiftKey: true });
		expect(onEventUpdate.mock.calls.at(-1)?.[LIST_SLOT_INDEX.first]).toMatchObject({ start: new Date("2026-03-16T09:15:00Z"), end: new Date("2026-03-16T10:00:00Z") });
	});

	it("rejects a drop that canDropEvent refuses and announces it", (): void => {
		const onEventUpdate = vi.fn<(update: EventCalendarProposedUpdate) => EventCalendarUpdateResult>(acceptUpdate);
		const refuse = vi.fn((): boolean => false);
		render(
			<CalendarHarness view="week" onEventUpdate={onEventUpdate} canDropEvent={refuse}>
				<EventCalendarWeekView />
			</CalendarHarness>,
		);
		fireEvent.keyDown(screen.getByRole("button", { name: /^Standup/ }), { key: "ArrowRight", altKey: true });
		expect(onEventUpdate).not.toHaveBeenCalled();
		expect(document.querySelector("[data-slot=event-calendar-announcer]")?.textContent).toBe("Can't place here");
	});

	it("drags a block to another day and time with the pointer", (): void => {
		stubColumnLayout();
		const onEventUpdate = vi.fn<(update: EventCalendarProposedUpdate) => EventCalendarUpdateResult>(acceptUpdate);
		render(
			<CalendarHarness view="week" onEventUpdate={onEventUpdate}>
				<EventCalendarWeekView />
			</CalendarHarness>,
		);
		const standup = screen.getByRole("button", { name: /^Standup/ });
		fireEvent.pointerDown(standup, { pointerId: 1, button: 0, clientX: 150, clientY: 540 });
		fireEvent.pointerMove(window, { pointerId: 1, clientX: 250, clientY: 600 });
		const ghost = document.querySelector("[data-slot=event-calendar-drag-ghost]");
		expect(ghost?.closest("[data-slot=event-calendar-day-column]")?.getAttribute("aria-label")).toBe("Tuesday, March 17th, 2026");
		fireEvent.pointerUp(window, { pointerId: 1 });
		expect(onEventUpdate.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]).toMatchObject({
			source: "drag",
			start: new Date("2026-03-17T10:00:00Z"),
			end: new Date("2026-03-17T10:30:00Z"),
		});
	});

	it("cancels a pointer drag with Escape", (): void => {
		stubColumnLayout();
		const onEventUpdate = vi.fn<(update: EventCalendarProposedUpdate) => EventCalendarUpdateResult>(acceptUpdate);
		render(
			<CalendarHarness view="week" onEventUpdate={onEventUpdate}>
				<EventCalendarWeekView />
			</CalendarHarness>,
		);
		fireEvent.pointerDown(screen.getByRole("button", { name: /^Standup/ }), { pointerId: 1, button: 0, clientX: 150, clientY: 540 });
		fireEvent.pointerMove(window, { pointerId: 1, clientX: 250, clientY: 600 });
		fireEvent.keyDown(window, { key: "Escape" });
		fireEvent.pointerUp(window, { pointerId: 1 });
		expect(onEventUpdate).not.toHaveBeenCalled();
		expect(document.querySelector("[data-slot=event-calendar-drag-ghost]")).toBeNull();
	});

	it("drag-creates a snapped timed draft in an empty column", (): void => {
		stubColumnLayout();
		const onSelectSlot = vi.fn<(slot: EventCalendarSlotDraft) => void>();
		render(
			<CalendarHarness view="week" onSelectSlot={onSelectSlot}>
				<EventCalendarWeekView />
			</CalendarHarness>,
		);
		const thursday = column("Thursday, March 19th, 2026");
		fireEvent.pointerDown(thursday, { pointerId: 3, button: 0, clientX: 450, clientY: 600 });
		fireEvent.pointerMove(window, { pointerId: 3, clientX: 450, clientY: 690 });
		expect(document.querySelector("[data-slot=event-calendar-slot-draft]")?.textContent).toBe("10:00 AM – 11:30 AM");
		fireEvent.pointerUp(window, { pointerId: 3 });
		expect(onSelectSlot.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]).toMatchObject({
			allDay: false,
			view: "week",
			start: new Date("2026-03-19T10:00:00Z"),
			end: new Date("2026-03-19T11:30:00Z"),
		});
	});

	it("blocks dragging a read-only event and reports it once", (): void => {
		stubColumnLayout();
		const onDragBlocked = vi.fn();
		render(
			<CalendarHarness view="week" onDragBlocked={onDragBlocked}>
				<EventCalendarWeekView />
			</CalendarHarness>,
		);
		fireEvent.pointerDown(screen.getByRole("button", { name: /^Locked slot/ }), { pointerId: 4, button: 0, clientX: 250, clientY: 780 });
		fireEvent.pointerMove(window, { pointerId: 4, clientX: 300, clientY: 800 });
		fireEvent.pointerMove(window, { pointerId: 4, clientX: 320, clientY: 820 });
		fireEvent.pointerUp(window, { pointerId: 4 });
		expect(onDragBlocked).toHaveBeenCalledTimes(1);
	});
});

describe("EventCalendarDayView / EventCalendarDaysView", () => {
	it("renders one column for the day view and dayCount columns for the N-days view", (): void => {
		const { unmount } = render(
			<CalendarHarness view="day" date={new Date("2026-03-16T08:00:00Z")}>
				<EventCalendarDayView interval={30} dayStartHour={8} dayEndHour={18} showAllDay={false} />
			</CalendarHarness>,
		);
		expect(document.querySelectorAll("[data-slot=event-calendar-day-column]")).toHaveLength(1);
		expect(document.querySelector("[data-slot=event-calendar-all-day-section]")).toBeNull();
		expect(document.querySelector("[data-slot=event-calendar-time-gutter]")?.children).toHaveLength(20);
		unmount();
		render(
			<CalendarHarness view="days" dayCount={4}>
				<EventCalendarDaysView />
			</CalendarHarness>,
		);
		expect(document.querySelectorAll("[data-slot=event-calendar-day-column]")).toHaveLength(4);
	});
});
