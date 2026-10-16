"use client";

import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Card, CardContent, CardFooter } from "@workspace/ui/components/card";
import { cn } from "@workspace/ui/lib/core/utils";
import { format, isSameDay, startOfToday } from "date-fns";
import { PlusIcon } from "lucide-react";
import type * as React from "react";
import { useState } from "react";

interface SampleEvent {
	readonly title: string;
	readonly start: Date;
	readonly end: Date;
	/** The colour of the event's side bar (a design token). */
	readonly barClassName: string;
}

const EVENTS: readonly SampleEvent[] = [
	{ title: "Product Launch", start: new Date("2026-01-24T10:00:00"), end: new Date("2026-01-24T11:30:00"), barClassName: "after:bg-success" },
	{ title: "Weekly Standup", start: new Date("2026-01-28T13:00:00"), end: new Date("2026-01-28T13:30:00"), barClassName: "after:bg-warning" },
	{ title: "Code Review Session", start: new Date("2026-01-31T15:00:00"), end: new Date("2026-01-31T16:00:00"), barClassName: "after:bg-info" },
];

const HEADING_DATE_FORMAT: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };

/** "Jan 24, 10:00 AM – 11:30 AM", or both full ends when the event spans days. */
function formatEventTime(start: Date, end: Date): string {
	const startText = format(start, "MMM d, h:mm a");
	return isSameDay(start, end) ? `${startText} – ${format(end, "h:mm a")}` : `${startText} – ${format(end, "MMM d, h:mm a")}`;
}

export function Calendar22Example(): React.JSX.Element {
	const [date, setDate] = useState<Date>(startOfToday);

	return (
		<Card className="w-2xs py-4">
			<CardContent className="px-4">
				<Calendar className="w-full bg-transparent p-0" mode="single" onSelect={setDate} required selected={date} />
			</CardContent>
			<CardFooter className="flex flex-col items-start gap-3 border-t px-4! pt-3! pb-0!">
				<div className="flex w-full items-center justify-between px-1">
					<div className="text-sm font-medium">{date.toLocaleDateString("en-US", HEADING_DATE_FORMAT)}</div>
					<Button className="size-6" size="icon" title="Add Event" variant="ghost">
						<PlusIcon />
						<span className="sr-only">Add Event</span>
					</Button>
				</div>
				<div className="flex w-full flex-col gap-2">
					{EVENTS.map((event: SampleEvent): React.JSX.Element => (
						<div
							className={cn("relative rounded-md bg-muted p-2 pl-6 text-sm after:absolute after:inset-y-2 after:left-2 after:w-1 after:rounded-full", event.barClassName)}
							key={event.title}>
							<div className="font-medium">{event.title}</div>
							<div className="text-xs text-muted-foreground">{formatEventTime(event.start, event.end)}</div>
						</div>
					))}
				</div>
			</CardFooter>
		</Card>
	);
}
