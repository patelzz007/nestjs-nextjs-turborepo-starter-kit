import type { CalendarEvent, EventCalendarTone } from "@workspace/ui-kit-logic";
import { EventCalendar } from "@workspace/ui-native/components/event-calendar";
import * as React from "react";
import { View } from "react-native";

import { atHour, SAMPLE_CLOCK, ToneLegend } from "./event-calendar-sample";

const LEGEND: readonly { readonly tone: EventCalendarTone; readonly label: string }[] = [
	{ tone: "green", label: "Occupied" },
	{ tone: "red", label: "Check-out" },
];
const EVENTS: readonly CalendarEvent[] = [
	{ id: "a", title: "Reed", start: atHour(2, 0), end: atHour(4, 0), allDay: true, color: "green" },
	{ id: "b", title: "Reed", start: atHour(4, 0), end: atHour(5, 0), allDay: true, color: "red" },
];

// The colours carry a meaning, and the legend says which.
export function EventCalendarDo2Example(): React.JSX.Element {
	return (
		<View className="w-full gap-3">
			<EventCalendar events={EVENTS} defaultView="month" clock={SAMPLE_CLOCK} showNav={false} />
			<ToneLegend entries={LEGEND} />
		</View>
	);
}
