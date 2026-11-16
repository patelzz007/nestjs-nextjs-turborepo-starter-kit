import type { CalendarEvent, EventCalendarResource, EventCalendarSlotDraft, EventCalendarTone } from "@workspace/ui-kit-logic";
import { EventCalendar } from "@workspace/ui-native/components/event-calendar";
import * as React from "react";
import { View } from "react-native";

import { atHour, SAMPLE_CLOCK, SAMPLE_WEEKDAY, ToneLegend } from "./event-calendar-sample";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;

const ROOMS: readonly EventCalendarResource[] = [
	{ id: "r101", title: "101 · King" },
	{ id: "r102", title: "102 · Queen" },
	{ id: "r204", title: "204 · Twin" },
	{ id: "r301", title: "Suite 301" },
];

type BookingStatus = "occupied" | "checkout" | "housekeeping" | "checkin";

/** One source of truth for a booking's status: its tone and its legend label. */
const STATUS: Readonly<Record<BookingStatus, { readonly label: string; readonly tone: EventCalendarTone }>> = {
	occupied: { label: "Occupied", tone: "green" },
	checkout: { label: "Check-out", tone: "red" },
	housekeeping: { label: "Housekeeping", tone: "teal" },
	checkin: { label: "Check-in", tone: "blue" },
};

const LEGEND = Object.values(STATUS);

function booking(id: string, title: string, startHour: number, endHour: number, resourceId: string, status: BookingStatus): CalendarEvent {
	return { id, title, start: atHour(SAMPLE_WEEKDAY, startHour), end: atHour(SAMPLE_WEEKDAY, endHour), resourceId, color: STATUS[status].tone };
}

/** A hotel's day: stays, turnovers, housekeeping and check-ins. */
const BOOKINGS: readonly CalendarEvent[] = [
	booking("stay-reed", "Occupied · Reed", 8, 10, "r101", "occupied"),
	booking("checkout-reed", "Check-out · Reed", 10, 10.5, "r101", "checkout"),
	booking("clean-101", "Housekeeping", 10.5, 12, "r101", "housekeeping"),
	booking("checkin-alvarez", "Check-in · Alvarez", 14, 15, "r101", "checkin"),
	booking("stay-chen", "Occupied · Chen", 8, 16, "r102", "occupied"),
	booking("checkout-chen", "Check-out · Chen", 16, 16.5, "r102", "checkout"),
	booking("clean-102", "Housekeeping", 16.5, 18, "r102", "housekeeping"),
	booking("checkout-novak", "Check-out · Novak", 11, 11.5, "r204", "checkout"),
	booking("clean-204", "Deep clean", 11.5, 13, "r204", "housekeeping"),
	booking("checkin-ford", "Check-in · Ford", 15, 16, "r204", "checkin"),
	booking("stay-ford", "Occupied · Ford", 16, 20, "r204", "occupied"),
	booking("clean-301", "Housekeeping", 8, 9.5, "r301", "housekeeping"),
	booking("checkin-osei", "Check-in · Osei", 10, 11, "r301", "checkin"),
	booking("stay-osei", "Occupied · Osei", 11, 20, "r301", "occupied"),
];

// Rooms as columns from 8:00 to 20:00; drag down a free stretch of a room to book it.
export function EventCalendar2Example(): React.JSX.Element {
	const [events, setEvents] = React.useState<readonly CalendarEvent[]>(BOOKINGS);
	const book = React.useCallback((slot: EventCalendarSlotDraft): void => {
		const { resourceId } = slot;
		if (resourceId === undefined) {
			return;
		}
		setEvents((current): readonly CalendarEvent[] => [
			...current,
			{ id: `booking-${String(current.length + 1)}`, title: "New booking", start: slot.start, end: slot.end, resourceId, color: STATUS.checkin.tone },
		]);
	}, []);
	return (
		<View className="w-full gap-3">
			<EventCalendar
				events={events}
				resources={ROOMS}
				defaultView="resource"
				clock={SAMPLE_CLOCK}
				dayStartHour={DAY_START_HOUR}
				dayEndHour={DAY_END_HOUR}
				onSelectSlot={book}
			/>
			<ToneLegend entries={LEGEND} />
		</View>
	);
}
