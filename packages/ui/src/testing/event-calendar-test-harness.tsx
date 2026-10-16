"use client";

// Test-only scaffolding shared by the event-calendar family's colocated tests:
// a fixed clock and time zone, a small typed event set, a controlled harness
// that owns the calendar state the way a real parent would (so interactions
// round-trip through the change callbacks), and a stub for the ResizeObserver
// jsdom does not implement.
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";

import { EventCalendar, type EventCalendarProps } from "@workspace/ui/components/event-calendar/event-calendar";
import type { CalendarEvent, CalendarView, EventCalendarSelection, EventCalendarViewSettings } from "@workspace/ui/components/event-calendar/event-calendar-types";

export const TEST_TIME_ZONE = "UTC";
/** Sunday 15 March 2026, 10:00 UTC. */
export const TEST_NOW = new Date("2026-03-15T10:00:00Z");

export interface TestEventData {
	readonly owner: string;
}

export const TEST_EVENTS: readonly CalendarEvent<TestEventData>[] = [
	{ id: "standup", title: "Standup", start: new Date("2026-03-16T09:00:00Z"), end: new Date("2026-03-16T09:30:00Z"), color: "blue", data: { owner: "ana" } },
	{ id: "review", title: "Design review", start: new Date("2026-03-16T09:15:00Z"), end: new Date("2026-03-16T10:30:00Z"), color: "green", data: { owner: "ben" } },
	{ id: "offsite", title: "Offsite", start: new Date("2026-03-18T00:00:00Z"), end: new Date("2026-03-20T00:00:00Z"), allDay: true, color: "violet", data: { owner: "cy" } },
	{ id: "locked", title: "Locked slot", start: new Date("2026-03-17T13:00:00Z"), end: new Date("2026-03-17T14:00:00Z"), readOnly: true, data: { owner: "dee" } },
];

export type HarnessProps = Omit<Partial<EventCalendarProps<TestEventData>>, "children"> & { readonly children: React.ReactNode };

/** A parent that controls events, view, date, day count, selection and view settings. */
export function CalendarHarness({
	events: initialEvents = TEST_EVENTS,
	view: initialView = "month",
	date: initialDate = TEST_NOW,
	onEventsChange,
	onViewChange,
	onDateChange,
	onSelectionChange,
	onViewSettingsChange,
	onDayCountChange,
	viewSettings: initialViewSettings = {},
	selection: initialSelection = { eventKeys: [], slot: null },
	children,
	...props
}: HarnessProps): React.JSX.Element {
	const [events, setEvents] = React.useState<readonly CalendarEvent<TestEventData>[]>(initialEvents);
	const [view, setView] = React.useState<CalendarView>(initialView);
	const [date, setDate] = React.useState<Date>(initialDate);
	const [dayCount, setDayCount] = React.useState(props.dayCount ?? 3);
	const [selection, setSelection] = React.useState<EventCalendarSelection>(initialSelection);
	const [viewSettings, setViewSettings] = React.useState<EventCalendarViewSettings>(initialViewSettings);
	const handleEvents = React.useCallback(
		(next: CalendarEvent<TestEventData>[]): void => {
			setEvents(next);
			onEventsChange?.(next);
		},
		[onEventsChange],
	);
	const handleView = React.useCallback(
		(next: CalendarView): void => {
			setView(next);
			onViewChange?.(next);
		},
		[onViewChange],
	);
	const handleDate = React.useCallback(
		(next: Date): void => {
			setDate(next);
			onDateChange?.(next);
		},
		[onDateChange],
	);
	const handleSelection = React.useCallback(
		(next: EventCalendarSelection): void => {
			setSelection(next);
			onSelectionChange?.(next);
		},
		[onSelectionChange],
	);
	const handleViewSettings = React.useCallback(
		(next: EventCalendarViewSettings): void => {
			setViewSettings(next);
			onViewSettingsChange?.(next);
		},
		[onViewSettingsChange],
	);
	const handleDayCount = React.useCallback(
		(next: number): void => {
			setDayCount(next);
			onDayCountChange?.(next);
		},
		[onDayCountChange],
	);
	return (
		<UiKitTestProviders>
			<EventCalendar<TestEventData>
				timeZone={TEST_TIME_ZONE}
				now={TEST_NOW}
				{...props}
				events={events}
				view={view}
				date={date}
				dayCount={dayCount}
				selection={selection}
				viewSettings={viewSettings}
				onEventsChange={handleEvents}
				onViewChange={handleView}
				onDateChange={handleDate}
				onSelectionChange={handleSelection}
				onViewSettingsChange={handleViewSettings}
				onDayCountChange={handleDayCount}>
				{children}
			</EventCalendar>
		</UiKitTestProviders>
	);
}

/** jsdom has no ResizeObserver; Base UI's scroll area and popups expect one. */
export class ResizeObserverStub {
	public observe(): void {
		return;
	}
	public unobserve(): void {
		return;
	}
	public disconnect(): void {
		return;
	}
}

/** A DOMRect-shaped box for stubbing layout jsdom does not compute. */
export function testRect(left: number, top: number, width: number, height: number): DOMRect {
	return new DOMRect(left, top, width, height);
}
