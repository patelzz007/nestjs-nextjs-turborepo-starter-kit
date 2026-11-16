import type { CalendarEvent } from "@workspace/ui-kit-logic";
import { EventCalendar } from "@workspace/ui-native/components/event-calendar";
import * as React from "react";

import { atHour, SAMPLE_CLOCK, SAMPLE_WEEKDAY } from "./event-calendar-sample";

const EVENTS: readonly CalendarEvent[] = [
	{ id: "a", title: "Consultation", start: atHour(SAMPLE_WEEKDAY, 10), end: atHour(SAMPLE_WEEKDAY, 11), color: "violet" },
	{ id: "b", title: "Follow-up", start: atHour(SAMPLE_WEEKDAY, 13), end: atHour(SAMPLE_WEEKDAY, 13.5), color: "blue" },
];

// Booking a time from a month: the hours are hidden behind a tap on each day.
export function EventCalendarDont1Example(): React.JSX.Element {
	return <EventCalendar events={EVENTS} defaultView="month" clock={SAMPLE_CLOCK} showNav={false} />;
}
