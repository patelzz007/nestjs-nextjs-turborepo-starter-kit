import { eventCalendarEventsOverlap, type CalendarEvent, type EventCalendarSlotDraft, type EventCalendarTone } from "@workspace/ui-kit-logic";
import { EventCalendar } from "@workspace/ui-native/components/event-calendar";
import * as React from "react";
import { Text, View } from "react-native";

import { atHour, SAMPLE_CLOCK, SAMPLE_WEEKDAY, ToneLegend } from "./event-calendar-sample";

const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 18;
const SLOT_MINUTES = 15;
const MINUTES_PER_HOUR = 60;

type Service = "consultation" | "followup" | "assessment" | "therapy";

const SERVICES: Readonly<Record<Service, { readonly label: string; readonly tone: EventCalendarTone }>> = {
	consultation: { label: "Consultation", tone: "violet" },
	followup: { label: "Follow-up", tone: "blue" },
	assessment: { label: "Assessment", tone: "yellow" },
	therapy: { label: "Therapy", tone: "red" },
};

const LEGEND = Object.values(SERVICES);

function appointment(id: string, client: string, service: Service, startHour: number, minutes: number): CalendarEvent {
	return {
		id,
		title: `${client} · ${SERVICES[service].label}`,
		start: atHour(SAMPLE_WEEKDAY, startHour),
		end: atHour(SAMPLE_WEEKDAY, startHour + minutes / MINUTES_PER_HOUR),
		color: SERVICES[service].tone,
	};
}

const APPOINTMENTS: readonly CalendarEvent[] = [
	appointment("a1", "Dana Whitfield", "consultation", 9, 45),
	appointment("a2", "Marco Reyes", "followup", 11, 45),
	appointment("a3", "Priya Nair", "assessment", 14, 60),
	appointment("a4", "Leon Fischer", "therapy", 16, 45),
];

// A consultant's day: drag down free time to book it; a draw over another appointment is refused.
export function EventCalendar5Example(): React.JSX.Element {
	const [events, setEvents] = React.useState<readonly CalendarEvent[]>(APPOINTMENTS);
	const [status, setStatus] = React.useState("Drag down a free stretch to book it.");
	const canBook = React.useCallback((slot: EventCalendarSlotDraft): boolean => !events.some((event): boolean => eventCalendarEventsOverlap(slot, event)), [events]);
	const book = React.useCallback((slot: EventCalendarSlotDraft): void => {
		setEvents((current): readonly CalendarEvent[] => [
			...current,
			{ id: `booking-${String(current.length + 1)}`, title: "New appointment", start: slot.start, end: slot.end, color: "teal" },
		]);
		setStatus("Booked.");
	}, []);
	return (
		<View className="w-full gap-3">
			<Text accessibilityLiveRegion="polite" className="text-caption font-sans text-muted-foreground">
				{status}
			</Text>
			<EventCalendar
				events={events}
				defaultView="day"
				clock={SAMPLE_CLOCK}
				dayStartHour={BUSINESS_START_HOUR}
				dayEndHour={BUSINESS_END_HOUR}
				slotMinutes={SLOT_MINUTES}
				onSelectSlot={book}
				canSelectSlot={canBook}
			/>
			<ToneLegend entries={LEGEND} />
		</View>
	);
}
