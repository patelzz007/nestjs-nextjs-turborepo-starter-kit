"use client";

import { PlusIcon } from "lucide-react";
import * as React from "react";
import { EventCalendar } from "@workspace/ui/components/event-calendar/event-calendar";
import { EventCalendarContent } from "@workspace/ui/components/event-calendar/event-calendar-content";
import { EVENT_CALENDAR_TONE_STYLES } from "@workspace/ui/components/event-calendar/event-calendar-event";
import { EventCalendarNav, EventCalendarToolbar } from "@workspace/ui/components/event-calendar/event-calendar-nav";
import type {
	CalendarEvent,
	CalendarView,
	EventCalendarInteractions,
	EventCalendarResource,
	EventCalendarTone,
} from "@workspace/ui/components/event-calendar/event-calendar-types";
import { addMinutes, setHours, startOfDay } from "date-fns";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";

/** The sample clock: Wednesday 17 June 2026, 09:30 local — fixed so the board always opens on the same day. */
const SAMPLE_NOW = new Date("2026-06-17T09:30:00");
const MINUTES_PER_HOUR = 60;
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;
/** New bookings land at noon in the first room and last an hour. */
const NEW_BOOKING_HOUR = 12;
const NEW_BOOKING_MINUTES = 60;

/** Rooms become columns in the resource day view - the time-grid layout tuned for space/booking scenarios. */
const ROOMS: readonly EventCalendarResource[] = [
	{ id: "r101", title: "101 · King", color: "blue" },
	{ id: "r102", title: "102 · Queen", color: "green" },
	{ id: "r204", title: "204 · Twin", color: "violet" },
	{ id: "r301", title: "Suite 301", color: "yellow" },
];

/** One source of truth for booking status: drives both the chip tone and the legend, so the two can never drift apart. */
type BookingStatus = "occupied" | "checkout" | "housekeeping" | "checkin";

interface BookingStatusInfo {
	readonly label: string;
	readonly tone: EventCalendarTone;
}

const STATUS: Readonly<Record<BookingStatus, BookingStatusInfo>> = {
	occupied: { label: "Occupied", tone: "green" },
	checkout: { label: "Check-out", tone: "red" },
	housekeeping: { label: "Housekeeping", tone: "teal" },
	checkin: { label: "Check-in", tone: "blue" },
};

const STATUS_LEGEND: readonly BookingStatusInfo[] = Object.values(STATUS);

interface BookingData {
	readonly status: BookingStatus;
}

/** A booking board reschedules and stretches stays, but a stray drag should not carve out a new booking - creation is the button. */
const INTERACTIONS: EventCalendarInteractions = { drag: true, resize: true, selectSlot: false };

/** Fractional hours (11.5 = 11:30) resolve through minutes so half-hour turnovers land precisely. */
function atHour(base: Date, hour: number): Date {
	return addMinutes(base, Math.round(hour * MINUTES_PER_HOUR));
}

function booking(base: Date, id: string, title: string, startHour: number, endHour: number, resourceId: string, status: BookingStatus): CalendarEvent<BookingData> {
	return { id, title, start: atHour(base, startHour), end: atHour(base, endHour), resourceId, color: STATUS[status].tone, data: { status } };
}

/** A hotel's day of room activity - stays, turnovers, housekeeping, and check-ins - anchored to the sample day so the resource view opens full. */
function buildBookings(anchor: Date): readonly CalendarEvent<BookingData>[] {
	const base = startOfDay(anchor);
	return [
		// 101 - morning stay, turnover, afternoon check-in
		booking(base, "stay-reed", "Occupied · Reed", 8, 10, "r101", "occupied"),
		booking(base, "checkout-reed", "Check-out · Reed", 10, 10.5, "r101", "checkout"),
		booking(base, "clean-101", "Housekeeping", 10.5, 12, "r101", "housekeeping"),
		booking(base, "checkin-alvarez", "Check-in · Alvarez", 14, 15, "r101", "checkin"),
		// 102 - long stay with a late-afternoon turnover
		booking(base, "stay-chen", "Occupied · Chen", 8, 16, "r102", "occupied"),
		booking(base, "checkout-chen", "Check-out · Chen", 16, 16.5, "r102", "checkout"),
		booking(base, "clean-102", "Housekeeping", 16.5, 18, "r102", "housekeeping"),
		// 204 - midday turnover into an evening stay
		booking(base, "checkout-novak", "Check-out · Novak", 11, 11.5, "r204", "checkout"),
		booking(base, "clean-204", "Deep clean", 11.5, 13, "r204", "housekeeping"),
		booking(base, "checkin-ford", "Check-in · Ford", 15, 16, "r204", "checkin"),
		booking(base, "stay-ford", "Occupied · Ford", 16, 20, "r204", "occupied"),
		// Suite 301 - early prep, mid-morning check-in, VIP stay
		booking(base, "clean-301", "Housekeeping", 8, 9.5, "r301", "housekeeping"),
		booking(base, "checkin-osei", "Check-in · Osei", 10, 11, "r301", "checkin"),
		booking(base, "stay-osei", "Occupied · Osei", 11, 20, "r301", "occupied"),
	];
}

const INITIAL_BOOKINGS: readonly CalendarEvent<BookingData>[] = buildBookings(SAMPLE_NOW);

export function EventCalendar2Example(): React.JSX.Element {
	const [events, setEvents] = React.useState<readonly CalendarEvent<BookingData>[]>(INITIAL_BOOKINGS);
	const [view, setView] = React.useState<CalendarView>("resource");
	const [date, setDate] = React.useState<Date>(SAMPLE_NOW);
	const bookingCount = React.useRef(0);

	// Add a one-hour booking at noon in the first room and jump to it - a minimal stand-in for a real "book a room" dialog.
	const addBooking = React.useCallback((): void => {
		const start = setHours(startOfDay(SAMPLE_NOW), NEW_BOOKING_HOUR);
		bookingCount.current += 1;
		const created: CalendarEvent<BookingData> = {
			id: `booking-${String(bookingCount.current)}`,
			title: "New booking",
			start,
			end: addMinutes(start, NEW_BOOKING_MINUTES),
			resourceId: "r101",
			color: STATUS.checkin.tone,
			data: { status: "checkin" },
		};
		setEvents((current: readonly CalendarEvent<BookingData>[]): readonly CalendarEvent<BookingData>[] => [...current, created]);
		setDate(start);
	}, []);

	return (
		<div className="w-full p-4">
			<Card className="w-full py-0">
				<CardContent className="p-0">
					<EventCalendar<BookingData>
						events={events}
						onEventsChange={setEvents}
						view={view}
						onViewChange={setView}
						date={date}
						onDateChange={setDate}
						now={SAMPLE_NOW}
						resources={ROOMS}
						dayStartHour={DAY_START_HOUR}
						dayEndHour={DAY_END_HOUR}
						interval={MINUTES_PER_HOUR}
						interactions={INTERACTIONS}
						className="h-150 w-full">
						<div className="flex flex-wrap items-center gap-2 pe-2">
							{/* resource is the only view here, so the switcher is hidden */}
							<EventCalendarNav className="min-w-0 flex-1" showViewSwitcher={false} />
							<EventCalendarToolbar>
								<Button size="sm" onClick={addBooking}>
									<PlusIcon className="size-4" aria-hidden="true" />
									New booking
								</Button>
							</EventCalendarToolbar>
						</div>
						<EventCalendarContent />
					</EventCalendar>
					{/* Status legend - each swatch paints the same tone token as its chips. */}
					<div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-3 text-xs text-muted-foreground">
						{STATUS_LEGEND.map((status: BookingStatusInfo): React.JSX.Element => (
							<span key={status.label} className="flex items-center gap-1.5">
								<span aria-hidden className="size-2 rounded-full bg-(--ec-event-color)" style={EVENT_CALENDAR_TONE_STYLES[status.tone]} />
								{status.label}
							</span>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
