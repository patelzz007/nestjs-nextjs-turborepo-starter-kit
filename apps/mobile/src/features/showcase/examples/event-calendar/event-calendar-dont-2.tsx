import type { CalendarEvent } from "@workspace/ui-kit-logic";
import { EventCalendar } from "@workspace/ui-native/components/event-calendar";
import * as React from "react";

import { atHour, SAMPLE_CLOCK } from "./event-calendar-sample";

const EVENTS: readonly CalendarEvent[] = [
	{ id: "a", title: "Reed", start: atHour(2, 0), end: atHour(4, 0), allDay: true, color: "green" },
	{ id: "b", title: "Reed", start: atHour(4, 0), end: atHour(5, 0), allDay: true, color: "red" },
];

// Green and red with nothing to say what they mean: the reader guesses, and colour-blind readers cannot.
export function EventCalendarDont2Example(): React.JSX.Element {
	return <EventCalendar events={EVENTS} defaultView="month" clock={SAMPLE_CLOCK} showNav={false} />;
}
