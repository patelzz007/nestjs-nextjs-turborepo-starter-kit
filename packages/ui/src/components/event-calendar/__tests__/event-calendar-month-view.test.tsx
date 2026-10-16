// @vitest-environment jsdom
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EventCalendarMonthView } from "../event-calendar-month-view";
import { CalendarHarness, ResizeObserverStub, testRect } from "@workspace/ui/testing/event-calendar-test-harness";
import type { EventCalendarOccurrence, EventCalendarProposedUpdate, EventCalendarSlotDraft, EventCalendarSlotInfo, EventCalendarUpdateResult } from "../event-calendar-types";

const CELL_SIZE_PX = 100;

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

/** Lays the month cells out on a 100px grid (jsdom computes no layout). */
function stubMonthLayout(): void {
	vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function stubRect(this: Element): DOMRect {
		if (!(this instanceof HTMLElement) || this.dataset.slot !== "event-calendar-month-cell") {
			return testRect(0, 0, 0, 0);
		}
		const cells = [...document.querySelectorAll("[data-slot=event-calendar-month-cell]")];
		const index = cells.indexOf(this);
		return testRect((index % 7) * CELL_SIZE_PX, Math.floor(index / 7) * CELL_SIZE_PX, CELL_SIZE_PX, CELL_SIZE_PX);
	});
}

function cell(name: string): HTMLElement {
	return screen.getByRole("gridcell", { name });
}

describe("EventCalendarMonthView", () => {
	it("renders an ARIA grid of six weeks with weekday headers and a forwarded ref", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(
			<CalendarHarness>
				<EventCalendarMonthView ref={ref} className="custom-month" />
			</CalendarHarness>,
		);
		const grid = screen.getByRole("grid", { name: "March 2026" });
		expect(grid).toBe(ref.current);
		expect(grid.className.split(" ").at(-1)).toBe("custom-month");
		expect(within(grid).getAllByRole("gridcell")).toHaveLength(42);
		expect(
			within(grid)
				.getAllByRole("columnheader")
				.map((header: HTMLElement): string => header.textContent),
		).toContain("SunS");
		expect(cell("Sunday, March 15th, 2026").getAttribute("aria-current")).toBe("date");
		expect(cell("Saturday, April 4th, 2026").dataset.outside).toBe("");
	});

	it("renders chips with time-aware names, tone styles and continuous bars", (): void => {
		render(
			<CalendarHarness>
				<EventCalendarMonthView />
			</CalendarHarness>,
		);
		const standup = screen.getByRole("button", { name: "Standup, 9:00 AM – 9:30 AM" });
		expect(standup.getAttribute("style")).toContain("--ec-event-color: var(--tone-blue)");
		expect(standup.textContent).toContain("9:00 AM");
		const offsite = screen.getByRole("button", { name: "Offsite, All day" });
		expect(offsite.closest("[data-slot=event-calendar-month-bar]")?.getAttribute("style")).toContain("span 2");
	});

	it("rolls overflow into a +N more popover listing only the hidden events", (): void => {
		render(
			<CalendarHarness maxEventsPerCell={1}>
				<EventCalendarMonthView />
			</CalendarHarness>,
		);
		fireEvent.click(screen.getByText("+2 more"));
		const popover = screen.getByRole("dialog", { name: "Monday, March 16" });
		expect(within(popover).getByRole("button", { name: /Standup/ })).toBeTruthy();
		expect(within(popover).getByRole("button", { name: /Design review/ })).toBeTruthy();
	});

	it("lets onMoreClick suppress the popover with preventDefault", (): void => {
		const onMoreClick = vi.fn((_day: Date, _occurrences: readonly EventCalendarOccurrence[], event: React.MouseEvent<HTMLElement>): void => {
			event.preventDefault();
		});
		render(
			<CalendarHarness maxEventsPerCell={1} onMoreClick={onMoreClick}>
				<EventCalendarMonthView />
			</CalendarHarness>,
		);
		fireEvent.click(screen.getByText("+2 more"));
		expect(onMoreClick.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.second]).toHaveLength(2);
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("moves a roving focus with the arrow keys and creates with Enter", (): void => {
		const onSlotClick = vi.fn<(slot: EventCalendarSlotInfo) => void>();
		render(
			<CalendarHarness onSlotClick={onSlotClick}>
				<EventCalendarMonthView />
			</CalendarHarness>,
		);
		const today = cell("Sunday, March 15th, 2026");
		expect(today.tabIndex).toBe(0);
		act((): void => {
			today.focus();
		});
		fireEvent.keyDown(today, { key: "ArrowRight" });
		const monday = cell("Monday, March 16th, 2026");
		expect(document.activeElement).toBe(monday);
		expect(monday.tabIndex).toBe(0);
		fireEvent.keyDown(monday, { key: "ArrowDown" });
		expect(document.activeElement).toBe(cell("Monday, March 23rd, 2026"));
		fireEvent.keyDown(document.activeElement ?? monday, { key: "Home" });
		expect(document.activeElement).toBe(cell("Sunday, March 22nd, 2026"));
		fireEvent.keyDown(document.activeElement ?? monday, { key: "Enter" });
		expect(onSlotClick.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]).toMatchObject({ allDay: true, view: "month", date: new Date("2026-03-22T00:00:00Z") });
	});

	it("changes month with PageDown and keeps the focused day", (): void => {
		const onDateChange = vi.fn<(date: Date) => void>();
		render(
			<CalendarHarness onDateChange={onDateChange}>
				<EventCalendarMonthView />
			</CalendarHarness>,
		);
		const today = cell("Sunday, March 15th, 2026");
		act((): void => {
			today.focus();
		});
		fireEvent.keyDown(today, { key: "PageDown" });
		expect(onDateChange.mock.calls.at(-1)?.[LIST_SLOT_INDEX.first]?.getTime()).toBe(Date.UTC(2026, 3, 15));
		expect(screen.getByRole("grid", { name: "April 2026" })).toBeTruthy();
		expect(document.activeElement).toBe(cell("Wednesday, April 15th, 2026"));
	});

	it("selects an event on click (additively with Shift)", (): void => {
		render(
			<CalendarHarness>
				<EventCalendarMonthView />
			</CalendarHarness>,
		);
		const standup = screen.getByRole("button", { name: /^Standup/ });
		fireEvent.click(standup);
		expect(standup.getAttribute("aria-pressed")).toBe("true");
		fireEvent.click(screen.getByRole("button", { name: /^Design review/ }), { shiftKey: true });
		expect(screen.getByRole("button", { name: /^Standup/ }).getAttribute("aria-pressed")).toBe("true");
		expect(screen.getByRole("button", { name: /^Design review/ }).getAttribute("aria-pressed")).toBe("true");
	});

	it("moves a focused event a day with Alt+ArrowRight and keeps focus on it", (): void => {
		const onEventUpdate = vi.fn<(update: EventCalendarProposedUpdate) => EventCalendarUpdateResult>(acceptUpdate);
		render(
			<CalendarHarness onEventUpdate={onEventUpdate}>
				<EventCalendarMonthView />
			</CalendarHarness>,
		);
		const standup = screen.getByRole("button", { name: /^Standup/ });
		act((): void => {
			standup.focus();
		});
		fireEvent.keyDown(standup, { key: "ArrowRight", altKey: true });
		expect(onEventUpdate.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]).toMatchObject({ source: "keyboard", start: new Date("2026-03-17T09:00:00Z") });
		const moved = screen.getByRole("button", { name: /^Standup/ });
		expect(moved.closest("[role=gridcell]")?.getAttribute("aria-label")).toBe("Tuesday, March 17th, 2026");
		expect(document.activeElement).toBe(moved);
		expect(document.querySelector("[data-slot=event-calendar-announcer]")?.textContent).toBe("Standup moved to 9:00 AM – 9:30 AM");
	});

	it("refuses keyboard moves of read-only events and reports why", (): void => {
		const onEventUpdate = vi.fn<(update: EventCalendarProposedUpdate) => EventCalendarUpdateResult>(acceptUpdate);
		const onDragBlocked = vi.fn();
		render(
			<CalendarHarness onEventUpdate={onEventUpdate} onDragBlocked={onDragBlocked}>
				<EventCalendarMonthView />
			</CalendarHarness>,
		);
		fireEvent.keyDown(screen.getByRole("button", { name: /^Locked slot/ }), { key: "ArrowRight", altKey: true });
		expect(onEventUpdate).not.toHaveBeenCalled();
		expect(onDragBlocked.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.second]).toEqual({ gesture: "move", reason: "readOnly" });
	});

	it("drags an event to another day with the pointer", (): void => {
		stubMonthLayout();
		const onEventUpdate = vi.fn<(update: EventCalendarProposedUpdate) => EventCalendarUpdateResult>(acceptUpdate);
		const onEventsChange = vi.fn();
		render(
			<CalendarHarness onEventUpdate={onEventUpdate} onEventsChange={onEventsChange}>
				<EventCalendarMonthView />
			</CalendarHarness>,
		);
		// 16 March is index 15 of the grid (row 2, column 1).
		const standup = screen.getByRole("button", { name: /^Standup/ });
		fireEvent.pointerDown(standup, { pointerId: 1, button: 0, clientX: 150, clientY: 250 });
		fireEvent.pointerMove(window, { pointerId: 1, clientX: 250, clientY: 250 });
		expect(document.querySelector("[data-slot=event-calendar-drag-ghost]")).not.toBeNull();
		expect(standup.dataset.dragging).toBe("");
		fireEvent.pointerUp(window, { pointerId: 1, clientX: 250, clientY: 250 });
		expect(onEventUpdate.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]).toMatchObject({
			source: "drag",
			start: new Date("2026-03-17T09:00:00Z"),
			end: new Date("2026-03-17T09:30:00Z"),
		});
		expect(onEventsChange).toHaveBeenCalledTimes(1);
		expect(document.querySelector("[data-slot=event-calendar-drag-ghost]")).toBeNull();
	});

	it("drag-creates an all-day range across cells", (): void => {
		stubMonthLayout();
		const onSelectSlot = vi.fn<(slot: EventCalendarSlotDraft) => void>();
		render(
			<CalendarHarness onSelectSlot={onSelectSlot}>
				<EventCalendarMonthView />
			</CalendarHarness>,
		);
		const thursday = cell("Thursday, March 26th, 2026");
		fireEvent.pointerDown(thursday, { pointerId: 2, button: 0, clientX: 450, clientY: 350 });
		fireEvent.pointerMove(window, { pointerId: 2, clientX: 650, clientY: 350 });
		expect(document.querySelector("[data-slot=event-calendar-slot-draft]")?.textContent).toBe("Mar 26 – Mar 28");
		fireEvent.pointerUp(window, { pointerId: 2 });
		expect(onSelectSlot.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]).toMatchObject({
			allDay: true,
			start: new Date("2026-03-26T00:00:00Z"),
			end: new Date("2026-03-29T00:00:00Z"),
		});
	});

	it("shows week numbers and a day add button when configured", (): void => {
		const onSlotClick = vi.fn<(slot: EventCalendarSlotInfo) => void>();
		render(
			<CalendarHarness showWeekNumbers showDayAddButton onSlotClick={onSlotClick}>
				<EventCalendarMonthView />
			</CalendarHarness>,
		);
		expect(screen.getAllByRole("rowheader").map((header: HTMLElement): string => header.textContent)).toContain("W12");
		const [firstAdd] = screen.getAllByRole("button", { name: "Add event" });
		if (firstAdd !== undefined) {
			fireEvent.click(firstAdd);
		}
		expect(onSlotClick).toHaveBeenCalledTimes(1);
	});
});
