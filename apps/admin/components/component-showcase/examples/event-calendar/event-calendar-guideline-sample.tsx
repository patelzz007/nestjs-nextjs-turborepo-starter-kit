"use client";

// The event calendar the Do / Don't pairs show: a week of meetings on the sample week, opened on the view a pair
// asks for, with or without a legend for its colours.

import { EventCalendar } from "@workspace/ui/components/event-calendar/event-calendar";
import { EventCalendarContent } from "@workspace/ui/components/event-calendar/event-calendar-content";
import { EventCalendarNav } from "@workspace/ui/components/event-calendar/event-calendar-nav";
import type { CalendarEvent, CalendarView, EventCalendarTone } from "@workspace/ui/components/event-calendar/event-calendar-types";
import { addDays, addHours, parseISO, startOfWeek } from "date-fns";
import * as React from "react";

/** The sample clock: Wednesday 17 June 2026, 09:30 — fixed so the calendar always opens on the same week. */
const SAMPLE_NOW = parseISO("2026-06-17T09:30:00");
const MONDAY = 1;
const WEEK = startOfWeek(SAMPLE_NOW, { weekStartsOn: MONDAY });

/** What each colour means, and its legend dot (whole class names, so the stylesheet keeps them). */
const TRACKS: readonly (readonly [EventCalendarTone, string, string])[] = [
	["blue", "Client meeting", "bg-(--tone-blue)"],
	["green", "Internal", "bg-(--tone-green)"],
	["red", "Deadline", "bg-(--tone-red)"],
];

/** One meeting: its title, its day of the week, its hour and its track's colour. */
type MeetingSpec = readonly [string, number, number, EventCalendarTone];

const MEETINGS: readonly MeetingSpec[] = [
	["Kickoff with Acme", 0, 10, "blue"],
	["Team standup", 1, 9, "green"],
	["Design review", 2, 14, "green"],
	["Proposal due", 3, 17, "red"],
	["Acme check-in", 4, 11, "blue"],
];

const EVENTS: readonly CalendarEvent[] = MEETINGS.map(([title, day, hour, color]: MeetingSpec): CalendarEvent => ({
	id: title,
	title,
	start: addHours(addDays(WEEK, day), hour),
	end: addHours(addDays(WEEK, day), hour + 1),
	color,
}));

export interface GuidelineCalendarProps {
	readonly initialView: CalendarView;
	/** A legend that says what each colour means. */
	readonly legend: boolean;
}

export function GuidelineCalendar({ initialView, legend }: GuidelineCalendarProps): React.JSX.Element {
	const [view, setView] = React.useState<CalendarView>(initialView);
	const [date, setDate] = React.useState<Date>(SAMPLE_NOW);
	return (
		<div className="flex w-full flex-col gap-2">
			{legend ? (
				<ul aria-label="What the colours mean" className="flex flex-wrap gap-3 text-xs text-muted-foreground">
					{TRACKS.map(([tone, label, dot]: readonly [EventCalendarTone, string, string]): React.JSX.Element => (
						<li key={tone} className="flex items-center gap-1.5">
							<span aria-hidden="true" className={`size-2.5 rounded-full ${dot}`} />
							{label}
						</li>
					))}
				</ul>
			) : null}
			<EventCalendar events={EVENTS} view={view} onViewChange={setView} date={date} onDateChange={setDate} now={SAMPLE_NOW} weekStartsOn={MONDAY} className="h-120 w-full">
				<EventCalendarNav />
				<EventCalendarContent />
			</EventCalendar>
		</div>
	);
}
