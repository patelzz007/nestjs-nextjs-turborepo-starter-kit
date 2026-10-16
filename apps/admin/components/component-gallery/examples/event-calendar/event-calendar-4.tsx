"use client";

import { CodeIcon, CompassIcon, FlagIcon, MegaphoneIcon, PaletteIcon, PlusIcon } from "lucide-react";
import * as React from "react";
import { EventCalendar, type EventCalendarRenderEventProps } from "@workspace/ui/components/event-calendar/event-calendar";
import { EventCalendarContent } from "@workspace/ui/components/event-calendar/event-calendar-content";
import { EVENT_CALENDAR_TONE_STYLES } from "@workspace/ui/components/event-calendar/event-calendar-event";
import { EventCalendarNav, EventCalendarToolbar } from "@workspace/ui/components/event-calendar/event-calendar-nav";
import type { CalendarEvent, CalendarView, EventCalendarInteractions, EventCalendarTone } from "@workspace/ui/components/event-calendar/event-calendar-types";
import { addDays, startOfDay, startOfWeek } from "date-fns";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";

/** The sample clock: Wednesday 17 June 2026, 09:30 local — fixed so the month always opens on the same bars. */
const SAMPLE_NOW = new Date("2026-06-17T09:30:00");
const MONDAY = 1;
const PROJECT_DAYS = 3;
const MILESTONE_DAYS = 1;

const CATEGORIES: readonly ["design", "engineering", "marketing", "product"] = ["design", "engineering", "marketing", "product"];

type Category = (typeof CATEGORIES)[number];

interface CategoryInfo {
	readonly label: string;
	readonly tone: EventCalendarTone;
	readonly icon: React.ReactNode;
}

/** One source of truth per track: the bar tone, its legend label, and the leading icon. */
const CATEGORY: Readonly<Record<Category, CategoryInfo>> = {
	design: { label: "Design", tone: "violet", icon: <PaletteIcon className="size-3.5" aria-hidden="true" /> },
	engineering: { label: "Engineering", tone: "blue", icon: <CodeIcon className="size-3.5" aria-hidden="true" /> },
	marketing: { label: "Marketing", tone: "orange", icon: <MegaphoneIcon className="size-3.5" aria-hidden="true" /> },
	product: { label: "Product", tone: "teal", icon: <CompassIcon className="size-3.5" aria-hidden="true" /> },
};

interface EventData {
	readonly category: Category;
}

/** Drag to reschedule a project, resize the edge to change how many days it spans; slot-drag creation stays off (it's a chip showcase). */
const INTERACTIONS: EventCalendarInteractions = { drag: true, resize: true, selectSlot: false };

function span(week: Date, id: string, title: string, startOffset: number, endOffset: number, category: Category): CalendarEvent<EventData> {
	// all-day, end-exclusive: [startOffset, endOffset) covers whole days
	return { id, title, start: addDays(week, startOffset), end: addDays(week, endOffset), allDay: true, color: CATEGORY[category].tone, data: { category } };
}

/** A month of cross-functional work: multi-day project bars you can drag to reschedule and resize by the edge. Anchored to the sample week so the month opens full. */
function buildEvents(anchor: Date): readonly CalendarEvent<EventData>[] {
	const week = startOfWeek(startOfDay(anchor), { weekStartsOn: MONDAY });
	return [
		span(week, "onboarding", "Onboarding revamp", -2, 1, "product"),
		span(week, "design-sprint", "Design sprint", 1, 4, "design"),
		span(week, "api-migration", "API migration", 2, 6, "engineering"),
		span(week, "user-research", "User research", 3, 5, "product"),
		span(week, "brand-refresh", "Brand refresh", 8, 10, "design"),
		span(week, "launch", "Launch campaign", 9, 13, "marketing"),
		span(week, "roadmap", "Roadmap review", 15, 16, "engineering"),
	];
}

const INITIAL_EVENTS: readonly CalendarEvent<EventData>[] = buildEvents(SAMPLE_NOW);

/** Fully custom chip via `renderEvent`: a compact single-row bar with an inline category icon and the title. */
function renderChip({ occurrence }: EventCalendarRenderEventProps<EventData>): React.ReactNode {
	const category = occurrence.event.data?.category;
	if (category === undefined) {
		return null;
	}
	return (
		<span className="flex w-full min-w-0 items-center gap-1.5">
			<span className="flex shrink-0 text-(--ec-event-color)">{CATEGORY[category].icon}</span>
			<span className="truncate font-medium">{occurrence.event.title}</span>
		</span>
	);
}

export function EventCalendar4Example(): React.JSX.Element {
	const [events, setEvents] = React.useState<readonly CalendarEvent<EventData>[]>(INITIAL_EVENTS);
	const [view, setView] = React.useState<CalendarView>("month");
	const [date, setDate] = React.useState<Date>(SAMPLE_NOW);
	const counter = React.useRef(0);

	const addAllDay = React.useCallback((prefix: string, title: string, days: number, category: Category): void => {
		const start = startOfDay(SAMPLE_NOW);
		counter.current += 1;
		const created: CalendarEvent<EventData> = {
			id: `${prefix}-${String(counter.current)}`,
			title,
			start,
			end: addDays(start, days),
			allDay: true,
			color: CATEGORY[category].tone,
			data: { category },
		};
		setEvents((current: readonly CalendarEvent<EventData>[]): readonly CalendarEvent<EventData>[] => [...current, created]);
		setDate(start);
	}, []);

	// Add a multi-day design project starting on the sample day and jump to it - a minimal stand-in for a real "new project" flow.
	const addProject = React.useCallback((): void => {
		addAllDay("project", "New project", PROJECT_DAYS, "design");
	}, [addAllDay]);

	// Add a single-day product milestone on the sample day.
	const addMilestone = React.useCallback((): void => {
		addAllDay("milestone", "Milestone", MILESTONE_DAYS, "product");
	}, [addAllDay]);

	return (
		<div className="w-full p-4">
			<Card className="w-full py-0">
				<CardContent className="p-0">
					<EventCalendar<EventData>
						events={events}
						onEventsChange={setEvents}
						view={view}
						onViewChange={setView}
						date={date}
						onDateChange={setDate}
						now={SAMPLE_NOW}
						weekStartsOn={MONDAY}
						renderEvent={renderChip}
						interactions={INTERACTIONS}
						className="h-160 w-full">
						<div className="flex flex-wrap items-center gap-2 pe-2">
							<EventCalendarNav className="min-w-0 flex-1" showViewSwitcher={false} />
							<EventCalendarToolbar>
								<Button variant="outline" size="sm" onClick={addMilestone}>
									<FlagIcon className="size-4" aria-hidden="true" />
									Milestone
								</Button>
								<Button size="sm" onClick={addProject}>
									<PlusIcon className="size-4" aria-hidden="true" />
									New project
								</Button>
							</EventCalendarToolbar>
						</div>
						<EventCalendarContent />
					</EventCalendar>
					{/* Track legend - each swatch paints the same tone token as its bars. */}
					<div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-3 text-xs text-muted-foreground">
						{CATEGORIES.map((key: Category): React.JSX.Element => (
							<span key={key} className="flex items-center gap-1.5">
								<span aria-hidden className="size-2 rounded-full bg-(--ec-event-color)" style={EVENT_CALENDAR_TONE_STYLES[CATEGORY[key].tone]} />
								{CATEGORY[key].label}
							</span>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
