"use client";

// The EventCalendar examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { EventCalendar1Example } from "@/components/component-gallery/examples/event-calendar/event-calendar-1";
import { EventCalendar2Example } from "@/components/component-gallery/examples/event-calendar/event-calendar-2";
import { EventCalendar3Example } from "@/components/component-gallery/examples/event-calendar/event-calendar-3";
import { EventCalendar4Example } from "@/components/component-gallery/examples/event-calendar/event-calendar-4";
import { EventCalendar5Example } from "@/components/component-gallery/examples/event-calendar/event-calendar-5";

export const EVENT_CALENDAR_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-event-calendar-1", label: "All Views", component: EventCalendar1Example },
	{ id: "c-event-calendar-2", label: "Room Bookings", component: EventCalendar2Example },
	{ id: "c-event-calendar-3", label: "Event Form Dialog", component: EventCalendar3Example },
	{ id: "c-event-calendar-4", label: "Custom Event Chips", component: EventCalendar4Example },
	{ id: "c-event-calendar-5", label: "Drag-to-Book", component: EventCalendar5Example },
];

export function EventCalendarExamples(): React.JSX.Element {
	return <ExampleGrid examples={EVENT_CALENDAR_EXAMPLES} />;
}
