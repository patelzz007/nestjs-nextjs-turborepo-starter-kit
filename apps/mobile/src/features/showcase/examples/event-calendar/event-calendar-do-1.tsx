import type { CalendarEvent } from "@workspace/ui-kit-logic";
import { EventCalendar } from "@workspace/ui-native/components/event-calendar";
import * as React from "react";

import { atHour, SAMPLE_CLOCK, SAMPLE_WEEKDAY } from "./event-calendar-sample";

const EVENTS: readonly CalendarEvent[] = [
	{ id: "a", title: "Consultation", start: atHour(SAMPLE_WEEKDAY, 10), end: atHour(SAMPLE_WEEKDAY, 11), color: "violet" },
	{ id: "b", title: "Follow-up", start: atHour(SAMPLE_WEEKDAY, 13), end: atHour(SAMPLE_WEEKDAY, 13.5), color: "blue" },
];
const START_HOUR = 9;
const END_HOUR = 15;

// Booking a time: the day on a time grid, the free stretches plain to see.
export function EventCalendarDo1Example(): React.JSX.Element {
	return <EventCalendar events={EVENTS} defaultView="day" clock={SAMPLE_CLOCK} dayStartHour={START_HOUR} dayEndHour={END_HOUR} showNav={false} />;
}
