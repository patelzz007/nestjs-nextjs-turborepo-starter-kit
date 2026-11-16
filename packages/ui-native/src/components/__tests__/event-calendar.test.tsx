import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { CalendarEvent, EventCalendarResource, EventCalendarSlotDraft } from "@workspace/ui-kit-logic";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import type { EventCalendarClock } from "../../lib/event-calendar";
import { SHEET_MOTION } from "../../lib/motion";
import { EventCalendar, type EventCalendarProps } from "../event-calendar";

const ZONE = "UTC";

function utc(iso: string): Date {
	return new Date(`${iso}Z`);
}

/** Wednesday 17 June 2026, 09:30 UTC. */
const CLOCK: EventCalendarClock = { nowEpochMs: (): number => utc("2026-06-17T09:30:00").getTime() };

const EVENTS: readonly CalendarEvent[] = [
	{ id: "standup", title: "Standup", start: utc("2026-06-17T09:00:00"), end: utc("2026-06-17T09:30:00"), color: "teal", resourceId: "room-1" },
	{ id: "review", title: "Design review", start: utc("2026-06-17T09:00:00"), end: utc("2026-06-17T10:30:00"), color: "violet", resourceId: "room-2" },
	{ id: "lunch", title: "Team lunch", start: utc("2026-06-17T12:00:00"), end: utc("2026-06-17T13:00:00") },
	{ id: "trip", title: "Offsite", start: utc("2026-06-22T00:00:00"), end: utc("2026-06-24T00:00:00"), allDay: true, color: "orange" },
];

const RESOURCES: readonly EventCalendarResource[] = [
	{ id: "room-1", title: "Room 1" },
	{ id: "room-2", title: "Room 2" },
];

function calendar(overrides: Partial<EventCalendarProps> = {}): React.JSX.Element {
	return <EventCalendar events={EVENTS} resources={RESOURCES} clock={CLOCK} timeZone={ZONE} dayStartHour={8} dayEndHour={14} testID="calendar" {...overrides} />;
}

/** A finger on the time grid, `y` points from its top. */
function touch(y: number, dy: number, timestamp: number): object {
	const record = {
		touchActive: true,
		startPageX: 0,
		startPageY: y - dy,
		startTimeStamp: 0,
		currentPageX: 0,
		currentPageY: y,
		currentTimeStamp: timestamp,
		previousPageX: 0,
		previousPageY: y - dy,
		previousTimeStamp: 0,
	};
	return {
		nativeEvent: { locationX: 10, locationY: y, pageX: 0, pageY: y, touches: [{ pageX: 0, pageY: y }], changedTouches: [{ pageX: 0, pageY: y }], timestamp },
		touchHistory: { indexOfSingleActiveTouch: 0, mostRecentTimeStamp: timestamp, numberActiveTouches: 1, touchBank: [record] },
	};
}

async function finishLeaving(): Promise<void> {
	await act((): void => {
		jest.advanceTimersByTime(SHEET_MOTION.exit.duration);
	});
}

beforeEach((): void => {
	jest.useFakeTimers();
});

afterEach((): void => {
	jest.useRealTimers();
});

describe("EventCalendar", () => {
	it("shows a month of days that say how many events they hold, and lists a tapped day's events", async () => {
		const onSlotPress = jest.fn<undefined, [EventCalendarSlotDraft]>();
		const onEventPress = jest.fn();
		await render(calendar({ onSlotPress, onEventPress }));

		expect(screen.getByRole("header", { name: "June 2026" })).toBeOnTheScreen();
		const wednesday = screen.getByRole("button", { name: "Wednesday, June 17th, 2026, 3 events" });
		await fireEvent.press(wednesday);
		expect(wednesday).toHaveProp("accessibilityState", { selected: true });
		expect(onSlotPress).toHaveBeenCalledWith(expect.objectContaining({ allDay: true, view: "month" }));

		await fireEvent.press(screen.getByRole("button", { name: /^Standup, 9:00 AM/u }));
		expect(onEventPress).toHaveBeenCalledWith(expect.objectContaining({ eventId: "standup" }));

		await fireEvent.press(wednesday);
		expect(screen.queryByRole("button", { name: /^Standup, 9:00 AM/u })).toBeNull();
		await fireEvent.press(screen.getByRole("button", { name: "Thursday, June 18th, 2026, 0 events" }));
		expect(screen.getByText("No events")).toBeOnTheScreen();
	});

	it("steps the period, comes back to today, and switches views", async () => {
		const onDateChange = jest.fn();
		const onViewChange = jest.fn();
		await render(calendar({ onDateChange, onViewChange }));

		await fireEvent.press(screen.getByRole("button", { name: "Next" }));
		expect(screen.getByRole("header", { name: "July 2026" })).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Previous" }));
		await fireEvent.press(screen.getByRole("button", { name: "Previous" }));
		expect(screen.getByRole("header", { name: "May 2026" })).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Today" }));
		expect(onDateChange).toHaveBeenCalledTimes(4);

		await fireEvent.press(screen.getByRole("button", { name: "Month" }));
		await fireEvent.press(screen.getByRole("radio", { name: "Agenda" }));
		await finishLeaving();
		expect(onViewChange).toHaveBeenCalledWith("agenda");
		expect(screen.getByRole("header", { name: "Wednesday, Jun 17" })).toBeOnTheScreen();
		expect(screen.getAllByRole("button", { name: /^Offsite, All day/u })).toHaveLength(2);
	});

	it("draws a day's events on the time grid, side by side where they overlap", async () => {
		await render(calendar({ defaultView: "day" }));

		expect(screen.getByRole("header", { name: "Wednesday, June 17, 2026" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: /^Standup/u })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: /^Design review/u })).toBeOnTheScreen();
		expect(screen.getByText("9 AM", { includeHiddenElements: true })).toBeOnTheScreen();
	});

	it("puts each resource in its own column, and draws the week", async () => {
		const { rerender } = await render(calendar({ view: "resource" }));
		expect(screen.getByText("Room 1")).toBeOnTheScreen();
		expect(screen.getByText("Room 2")).toBeOnTheScreen();
		expect(screen.getAllByRole("button", { name: /^Standup/u })).toHaveLength(1);

		await rerender(calendar({ view: "week" }));
		expect(screen.getByText("Wed 17")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: /^Team lunch/u })).toBeOnTheScreen();
	});

	it("books a slot dragged down free time, refuses one the caller rules out, and reports a tapped slot", async () => {
		const onSelectSlot = jest.fn<undefined, [EventCalendarSlotDraft]>();
		const onSlotPress = jest.fn<undefined, [EventCalendarSlotDraft]>();
		const canSelectSlot = jest.fn((slot: EventCalendarSlotDraft): boolean => slot.start.getUTCHours() >= 11);
		await render(calendar({ view: "resource", onSelectSlot, onSlotPress, canSelectSlot, slotMinutes: 30 }));
		const room = screen.getByLabelText("Room 1");

		// 144 pt is 11:00 (8:00 + 3 × 48 pt); the drag ends inside the 11:30–12:00 slot.
		await fireEvent(room, "responderGrant", touch(144, 0, 1));
		await fireEvent(room, "responderMove", touch(170, 26, 2));
		await fireEvent(room, "responderRelease", touch(170, 26, 3));
		expect(onSelectSlot).toHaveBeenCalledWith({ start: utc("2026-06-17T11:00:00"), end: utc("2026-06-17T12:00:00"), allDay: false, view: "resource", resourceId: "room-1" });

		await fireEvent(room, "responderGrant", touch(10, 0, 4));
		await fireEvent(room, "responderMove", touch(60, 50, 5));
		await fireEvent(room, "responderRelease", touch(60, 50, 6));
		expect(onSelectSlot).toHaveBeenCalledTimes(1);

		await fireEvent(room, "responderGrant", touch(10, 0, 7));
		await fireEvent(room, "responderRelease", touch(10, 0, 8));
		expect(onSlotPress).toHaveBeenCalledWith(expect.objectContaining({ start: utc("2026-06-17T08:00:00"), end: utc("2026-06-17T08:30:00") }));

		await fireEvent(room, "responderGrant", touch(10, 0, 9));
		await fireEvent(room, "responderTerminate", touch(10, 0, 10));
		expect(onSlotPress).toHaveBeenCalledTimes(1);
	});

	it("draws events the caller's way, and can leave out the toolbar", async () => {
		const renderEvent = (occurrence: { readonly event: CalendarEvent }): React.JSX.Element => <Text>{`★ ${occurrence.event.title}`}</Text>;
		const { rerender } = await render(calendar({ renderEvent, toolbarContent: <Text>Legend</Text> }));
		expect(screen.getAllByText("★ Standup", { includeHiddenElements: true }).length).toBeGreaterThan(0);
		expect(screen.getByText("Legend")).toBeOnTheScreen();

		await rerender(calendar({ showNav: false, view: "agenda", events: [], offDays: false }));
		expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
		expect(screen.getByText("No events")).toBeOnTheScreen();
	});

	it("follows a controlled date, forwards its ref and merges the caller's className", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<EventCalendar ref={ref} events={EVENTS} date={utc("2026-08-05T12:00:00")} timeZone={ZONE} weekStartsOn={1} className="mt-2" testID="calendar" />);
		expect(screen.getByRole("header", { name: "August 2026" })).toBeOnTheScreen();
		expect(ref.current).not.toBeNull();
		expect(screen.getByTestId("calendar")).toHaveProp("className", expect.stringContaining("mt-2"));
	});

	it("draws the caller's chips on the time grid, and reports a tapped slot of a day without a resource", async () => {
		const onSlotPress = jest.fn<undefined, [EventCalendarSlotDraft]>();
		const renderEvent = (occurrence: { readonly event: CalendarEvent }): React.JSX.Element => <Text>{`★ ${occurrence.event.title}`}</Text>;
		await render(calendar({ view: "day", renderEvent, onSlotPress }));
		expect(screen.getByText("★ Standup")).toBeOnTheScreen();

		const day = screen.getByLabelText("Wed 17");
		await fireEvent(day, "responderGrant", touch(48, 0, 1));
		await fireEvent(day, "responderMove", touch(50, 2, 2));
		await fireEvent(day, "responderRelease", touch(50, 2, 3));
		expect(onSlotPress).toHaveBeenCalledWith({ start: utc("2026-06-17T09:00:00"), end: utc("2026-06-17T09:30:00"), allDay: false, view: "day" });
	});

	it("books any drawn slot when nothing guards it", async () => {
		const onSelectSlot = jest.fn<undefined, [EventCalendarSlotDraft]>();
		await render(calendar({ view: "day", onSelectSlot }));
		const day = screen.getByLabelText("Wed 17");

		await fireEvent(day, "responderGrant", touch(0, 0, 1));
		await fireEvent(day, "responderMove", touch(100, 100, 2));
		await fireEvent(day, "responderRelease", touch(100, 100, 3));
		expect(onSelectSlot).toHaveBeenCalledWith(expect.objectContaining({ start: utc("2026-06-17T08:00:00"), end: utc("2026-06-17T10:30:00") }));
	});

	it("names the one-day strip when its view is offered, and opens on the device's zone without events", async () => {
		const { rerender } = await render(calendar({ views: ["month", "days"], view: "days" }));
		expect(screen.getByRole("button", { name: "1 day" })).toBeOnTheScreen();

		await rerender(<EventCalendar clock={CLOCK} testID="calendar" />);
		expect(screen.getByTestId("calendar")).toBeOnTheScreen();
	});
});
