"use client";

import { addDays, format, parseISO, startOfWeek } from "date-fns";
import * as React from "react";

import { Card, CardContent } from "@workspace/ui/components/card";
import { Gantt, type GanttTreePanelConfig } from "@workspace/ui/components/gantt/gantt";
import { resolveOffDay, toZoned, zonedStartOfDay } from "@workspace/ui/components/gantt/gantt-lib";
import { GanttNav } from "@workspace/ui/components/gantt/gantt-nav";
import type {
	GanttClock,
	GanttEvent,
	GanttInteractions,
	GanttOffDaysConfig,
	GanttProposedUpdate,
	GanttResource,
	GanttUpdateResult,
} from "@workspace/ui/components/gantt/gantt-types";
import { GanttView } from "@workspace/ui/components/gantt/gantt-view";

/**
 * The team's calendar zone. The gantt lays out and shades its days in it, and
 * the adjustment below counts working days in it, so the two always agree.
 */
const TIME_ZONE = "America/New_York";

/** The sample clock: Wednesday 17 June 2026, 09:30 — fixed so the plan always opens on the same week. */
const SAMPLE_NOW = parseISO("2026-06-17T09:30:00");
const SAMPLE_CLOCK: GanttClock = {
	nowEpochMs(): number {
		return SAMPLE_NOW.getTime();
	},
};

const TREE_PANEL: GanttTreePanelConfig = { width: 200 };
/** Every change is a move, so every change keeps its working days. */
const INTERACTIONS: Partial<GanttInteractions> = { resize: false };
const DAY_FORMAT = "EEE, MMM d";
/** Saturday and Sunday (0 = Sunday). */
const WEEKEND_DAYS: readonly number[] = [0, 6];
/** The holiday is this week's Friday. */
const HOLIDAY_OFFSET_DAYS = 5;
/** The view opens on the holiday weekend. */
const FOCUS_OFFSET_DAYS = 6;

const RESOURCES: readonly GanttResource[] = [
	{ id: "scope", title: "Scope review" },
	{ id: "api", title: "API endpoints" },
	{ id: "screens", title: "Client screens" },
	{ id: "qa", title: "QA pass" },
	{ id: "notes", title: "Release notes" },
];

/** Zoned midnight `days` away: safe across a daylight-saving change, where adding 24 hours is not. */
export function shiftDays(day: Date, days: number): Date {
	return zonedStartOfDay(addDays(toZoned(day, TIME_ZONE), days), TIME_ZONE);
}

/** The Sunday that starts the sample week. */
const WEEK: Date = startOfWeek(zonedStartOfDay(SAMPLE_NOW, TIME_ZONE), { weekStartsOn: 0 });

/** Weekends, plus a holiday on this week's Friday, in the same zone. */
export const OFF_DAYS: GanttOffDaysConfig = { weekendDays: WEEKEND_DAYS, dates: [shiftDays(WEEK, HOLIDAY_OFFSET_DAYS)] };

function bar(resourceId: string, title: string, startOffset: number, days: number, color: string): GanttEvent {
	return { id: `bar-${resourceId}`, title, start: shiftDays(WEEK, startOffset), end: shiftDays(WEEK, startOffset + days), allDay: true, color, resourceId };
}

const BARS: readonly GanttEvent[] = [
	bar("scope", "Scope review", 1, 2, "var(--color-blue-500)"),
	// Four working days across the Friday holiday and the weekend: Wednesday to Tuesday.
	bar("api", "API endpoints", 3, 7, "var(--color-violet-500)"),
	bar("screens", "Client screens", 10, 2, "var(--color-sky-500)"),
	bar("qa", "QA pass", 12, 4, "var(--color-emerald-500)"),
	bar("notes", "Release notes", 16, 1, "var(--color-amber-500)"),
];

/** Working days in [start, end), read from the same config the gantt shades. */
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

function formatDay(day: Date): string {
	return format(toZoned(day, TIME_ZONE), DAY_FORMAT);
}

export function Gantt8Example(): React.JSX.Element {
	const [status, setStatus] = React.useState("Drop a bar on a weekend or the holiday: it starts on the next working day.");

	// The gantt moves a bar by calendar days; this runs once on release and
	// returns the dates to commit instead. `event` is the bar before the move.
	const keepWorkingDays = React.useCallback(({ event, start, source }: GanttProposedUpdate): GanttUpdateResult => {
		// A milestone (zero length) stays a point.
		if (source !== "drag" || event.start.getTime() === event.end.getTime()) {
			return undefined;
		}
		const first = nextWorkday(start, OFF_DAYS);
		const days = Math.max(countWorkdays(event.start, event.end, OFF_DAYS), 1);
		const end = addWorkdays(first, days, OFF_DAYS);
		setStatus(`${event.title}: ${formatDay(first)} to ${formatDay(shiftDays(end, -1))}, ${String(days)} working ${days === 1 ? "day" : "days"}`);
		return { start: first, end };
	}, []);

	return (
		<div className="w-full p-4">
			<Card className="w-full py-0">
				<CardContent className="p-0">
					<Gantt
						defaultEvents={BARS}
						resources={RESOURCES}
						defaultScale="month"
						initialCenter={shiftDays(WEEK, FOCUS_OFFSET_DAYS)}
						timeZone={TIME_ZONE}
						clock={SAMPLE_CLOCK}
						offDays={OFF_DAYS}
						onEventUpdate={keepWorkingDays}
						defaultInteractions={INTERACTIONS}
						treePanel={TREE_PANEL}
						className="h-[360px] w-full">
						<GanttNav />
						<GanttView />
						<p role="status" className="border-t px-3 py-2 text-muted-foreground">
							{status}
						</p>
					</Gantt>
				</CardContent>
			</Card>
		</div>
	);
}
