import { resolveOffDay, type GanttEvent, type GanttOffDaysConfig, type GanttProposedUpdate, type GanttResource, type GanttUpdateAdjustment } from "@workspace/ui-kit-logic";
import { Gantt } from "@workspace/ui-native/components/gantt";
import * as React from "react";
import { Text, View } from "react-native";

import { SAMPLE_CLOCK, sampleBar, sampleDay } from "./gantt-sample";

/** The holiday is this week's Friday (five days after the sample Sunday). */
const HOLIDAY_OFFSET_DAYS = 5;
const WEEKEND_DAYS: readonly number[] = [0, 6];

/** Weekends, plus a holiday on this week's Friday. */
export const OFF_DAYS: GanttOffDaysConfig = { weekendDays: WEEKEND_DAYS, dates: [sampleDay(HOLIDAY_OFFSET_DAYS)] };

/** This device's zone: the sample days are local midnights. */
const TIME_ZONE = new Intl.DateTimeFormat().resolvedOptions().timeZone;

const RESOURCES: readonly GanttResource[] = [
	{ id: "scope", title: "Scope review" },
	{ id: "api", title: "API endpoints" },
	{ id: "screens", title: "Client screens" },
	{ id: "qa", title: "QA pass" },
	{ id: "notes", title: "Release notes" },
];

const BARS: readonly GanttEvent[] = [
	sampleBar("scope", "Scope review", 1, 2, "blue"),
	// Four working days across the Friday holiday and the weekend: Wednesday to Tuesday.
	sampleBar("api", "API endpoints", 3, 7, "violet"),
	sampleBar("screens", "Client screens", 10, 2, "teal"),
	sampleBar("qa", "QA pass", 12, 4, "green"),
	sampleBar("notes", "Release notes", 16, 1, "yellow"),
];

/** `day` moved by `days` whole days, at local midnight. */
function shiftDays(day: Date, days: number): Date {
	return new Date(day.getFullYear(), day.getMonth(), day.getDate() + days);
}

/** Working days in [start, end). */
export function countWorkdays(start: Date, end: Date, offDays: GanttOffDaysConfig): number {
	let count = 0;
	for (let day = start; day < end; day = shiftDays(day, 1)) {
		if (!resolveOffDay(day, TIME_ZONE, offDays)) {
			count += 1;
		}
	}
	return count;
}

/** The exclusive end after `count` working days, counted from a working-day start. */
export function addWorkdays(start: Date, count: number, offDays: GanttOffDaysConfig): Date {
	let day = start;
	for (let left = count; left > 0; day = shiftDays(day, 1)) {
		if (!resolveOffDay(day, TIME_ZONE, offDays)) {
			left -= 1;
		}
	}
	return day;
}

/** The first working day on or after `day`. */
export function nextWorkday(day: Date, offDays: GanttOffDaysConfig): Date {
	let first = day;
	while (resolveOffDay(first, TIME_ZONE, offDays)) {
		first = shiftDays(first, 1);
	}
	return first;
}

const DAY_NAMES = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

// A move that lands on a weekend or the holiday settles on the next working day, keeping its working-day length.
export function Gantt8Example(): React.JSX.Element {
	const [status, setStatus] = React.useState("Move a bar onto a weekend or the holiday: it starts on the next working day.");
	const handleEventUpdate = React.useCallback((update: GanttProposedUpdate): GanttUpdateAdjustment => {
		const workdays = Math.max(1, countWorkdays(update.event.start, update.event.end, OFF_DAYS));
		const start = nextWorkday(update.start, OFF_DAYS);
		const end = addWorkdays(start, workdays, OFF_DAYS);
		setStatus(`${update.event.title}: ${DAY_NAMES.format(start)}, ${String(workdays)} working day${workdays === 1 ? "" : "s"}`);
		return { start, end };
	}, []);
	return (
		<View className="w-full gap-3">
			<Text accessibilityLiveRegion="polite" className="text-caption font-sans text-muted-foreground">
				{status}
			</Text>
			<Gantt defaultEvents={BARS} resources={RESOURCES} defaultScale="month" clock={SAMPLE_CLOCK} offDays={OFF_DAYS} timeZone={TIME_ZONE} onEventUpdate={handleEventUpdate} />
		</View>
	);
}
