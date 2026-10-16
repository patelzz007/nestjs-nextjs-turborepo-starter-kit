"use client";

import { ListIcon, PlusIcon } from "lucide-react";
import * as React from "react";
import { EventCalendar, type EventCalendarRenderEventProps } from "@workspace/ui/components/event-calendar/event-calendar";
import { EventCalendarContent } from "@workspace/ui/components/event-calendar/event-calendar-content";
import { eventsOverlap } from "@workspace/ui/components/event-calendar/event-calendar-lib";
import { EventCalendarNav, EventCalendarToolbar } from "@workspace/ui/components/event-calendar/event-calendar-nav";
import type {
	CalendarEvent,
	CalendarView,
	EventCalendarDateRange,
	EventCalendarInteractions,
	EventCalendarSlotDraft,
	EventCalendarTone,
} from "@workspace/ui/components/event-calendar/event-calendar-types";
import { addMinutes, setHours, startOfDay } from "date-fns";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";

/** The sample clock: Wednesday 17 June 2026, 08:30 local — fixed so the day view always opens on the same appointments. */
const SAMPLE_NOW = new Date("2026-06-17T08:30:00");
const MINUTES_PER_HOUR = 60;
const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 18;
const GRID_INTERVAL_MINUTES = 30;
const SNAP_MINUTES = 15;
/** The toolbar shortcut books this long a slot, probing every grid interval for a free one. */
const APPOINTMENT_MINUTES = 45;
/** A block this tall (in minutes) has room for the second, service line. */
const SERVICE_LINE_MIN_MINUTES = 45;

type Service = "consultation" | "followup" | "assessment" | "therapy";

interface ServiceInfo {
	readonly label: string;
	readonly tone: EventCalendarTone;
}

/** Each service type carries its own tone, so the day reads as a colour-coded schedule at a glance. */
const SERVICE: Readonly<Record<Service, ServiceInfo>> = {
	consultation: { label: "Consultation", tone: "violet" },
	followup: { label: "Follow-up", tone: "blue" },
	assessment: { label: "Assessment", tone: "yellow" },
	therapy: { label: "Therapy", tone: "red" },
};

const NEW_TONE: EventCalendarTone = "green";

interface ApptData {
	readonly client: string;
	readonly initials: string;
	readonly avatar?: string;
	readonly service?: Service;
}

const NEW_APPOINTMENT_DATA: ApptData = { client: "New appointment", initials: "+" };

/** Booking is the whole point: drag an empty span to create; moving and resizing existing appointments stays on for rescheduling. */
const INTERACTIONS: EventCalendarInteractions = { drag: true, resize: true, selectSlot: true };

interface AppointmentSeed {
	readonly id: string;
	readonly client: string;
	readonly initials: string;
	readonly avatar: string;
	readonly service: Service;
	readonly startHour: number;
	readonly minutes: number;
}

const APPOINTMENT_SEEDS: readonly AppointmentSeed[] = [
	{ id: "a1", client: "Dana Whitfield", initials: "DW", avatar: "https://randomuser.me/api/portraits/women/44.jpg", service: "consultation", startHour: 9, minutes: 45 },
	{ id: "a2", client: "Marco Reyes", initials: "MR", avatar: "https://randomuser.me/api/portraits/men/32.jpg", service: "followup", startHour: 11, minutes: 45 },
	{ id: "a3", client: "Priya Nair", initials: "PN", avatar: "https://randomuser.me/api/portraits/women/68.jpg", service: "assessment", startHour: 14, minutes: 60 },
	{ id: "a4", client: "Leon Fischer", initials: "LF", avatar: "https://randomuser.me/api/portraits/men/75.jpg", service: "therapy", startHour: 16, minutes: 45 },
];

/** A consultant's day with colour-coded appointments and deliberate gaps to drag into. */
function buildAppointments(anchor: Date): readonly CalendarEvent<ApptData>[] {
	const base = startOfDay(anchor);
	return APPOINTMENT_SEEDS.map((seed: AppointmentSeed): CalendarEvent<ApptData> => {
		const start = setHours(base, seed.startHour);
		return {
			id: seed.id,
			title: seed.client,
			start,
			end: addMinutes(start, seed.minutes),
			color: SERVICE[seed.service].tone,
			data: { client: seed.client, initials: seed.initials, avatar: seed.avatar, service: seed.service },
		};
	});
}

const INITIAL_APPOINTMENTS: readonly CalendarEvent<ApptData>[] = buildAppointments(SAMPLE_NOW);

function overlapsAny(events: readonly CalendarEvent<ApptData>[], range: EventCalendarDateRange): boolean {
	return events.some((event: CalendarEvent<ApptData>): boolean => eventsOverlap(event, range));
}

/** The first free appointment-length slot in business hours on the sample day, or null when the day is full. */
function findOpenSlot(events: readonly CalendarEvent<ApptData>[]): EventCalendarDateRange | null {
	const base = startOfDay(SAMPLE_NOW);
	for (let minutes = BUSINESS_START_HOUR * MINUTES_PER_HOUR; minutes + APPOINTMENT_MINUTES <= BUSINESS_END_HOUR * MINUTES_PER_HOUR; minutes += GRID_INTERVAL_MINUTES) {
		const start = addMinutes(base, minutes);
		const range: EventCalendarDateRange = { start, end: addMinutes(start, APPOINTMENT_MINUTES) };
		if (!overlapsAny(events, range)) {
			return range;
		}
	}
	return null;
}

function ServiceLine({ service }: { readonly service: ServiceInfo }): React.JSX.Element {
	return <span className="truncate ps-6.5 text-xs font-medium text-(--ec-event-color)">{service.label}</span>;
}

/** Richer chip via `renderEvent`: an initials badge, the client name, and - when the block is tall enough - the service type on a second aligned line. */
function renderChip({ occurrence, segment }: EventCalendarRenderEventProps<ApptData>): React.ReactNode {
	const data = occurrence.event.data;
	if (data === undefined) {
		return null;
	}
	const service = data.service === undefined ? null : SERVICE[data.service];
	const minutes = (segment.endMin ?? 0) - (segment.startMin ?? 0);

	return (
		<span className="flex h-full w-full min-w-0 flex-col justify-start gap-0.5">
			<span className="flex min-w-0 items-center gap-1.5">
				<Avatar className="size-5 shrink-0">
					{data.avatar === undefined ? null : <AvatarImage src={data.avatar} alt={data.client} />}
					<AvatarFallback className="bg-(--ec-event-color)/25 text-xs font-semibold text-(--ec-event-color)">{data.initials}</AvatarFallback>
				</Avatar>
				<span className="truncate font-medium">{data.client}</span>
			</span>
			{service !== null && minutes >= SERVICE_LINE_MIN_MINUTES ? <ServiceLine service={service} /> : null}
		</span>
	);
}

export function EventCalendar5Example(): React.JSX.Element {
	const [events, setEvents] = React.useState<readonly CalendarEvent<ApptData>[]>(INITIAL_APPOINTMENTS);
	const [view, setView] = React.useState<CalendarView>("day");
	const [date, setDate] = React.useState<Date>(SAMPLE_NOW);
	const counter = React.useRef(0);

	const addAppointmentAt = React.useCallback((range: EventCalendarDateRange): void => {
		counter.current += 1;
		const created: CalendarEvent<ApptData> = {
			id: `appt-${String(counter.current)}`,
			title: "New appointment",
			start: range.start,
			end: range.end,
			color: NEW_TONE,
			data: NEW_APPOINTMENT_DATA,
		};
		setEvents((current: readonly CalendarEvent<ApptData>[]): readonly CalendarEvent<ApptData>[] => [...current, created]);
	}, []);

	// Drag across an open span to book it. The calendar reports the drawn slot but does NOT insert anything -
	// `onSelectSlot` is where the appointment is actually created, so real apps can open a form or hit an API here instead.
	const bookSlot = React.useCallback(
		(slot: EventCalendarSlotDraft): void => {
			addAppointmentAt(slot);
		},
		[addAppointmentAt],
	);

	// Refuse a draw that would overlap an existing appointment - no double-booking. Returning false cancels the create gesture.
	const canBook = React.useCallback((slot: EventCalendarSlotDraft): boolean => !overlapsAny(events, slot), [events]);

	// Book the first open slot in business hours and jump to it - the toolbar shortcut for the same thing the drag gesture does.
	const addAppointment = React.useCallback((): void => {
		const slot = findOpenSlot(events);
		if (slot === null) {
			return;
		}
		addAppointmentAt(slot);
		setDate(slot.start);
	}, [addAppointmentAt, events]);

	const showAgenda = React.useCallback((): void => {
		setView("agenda");
	}, []);

	return (
		<div className="w-full p-4">
			<Card className="w-full py-0">
				<CardContent className="p-0">
					<EventCalendar<ApptData>
						events={events}
						onEventsChange={setEvents}
						view={view}
						onViewChange={setView}
						date={date}
						onDateChange={setDate}
						now={SAMPLE_NOW}
						dayStartHour={BUSINESS_START_HOUR}
						dayEndHour={BUSINESS_END_HOUR}
						interval={GRID_INTERVAL_MINUTES}
						snapDuration={SNAP_MINUTES}
						renderEvent={renderChip}
						onSelectSlot={bookSlot}
						canSelectSlot={canBook}
						interactions={INTERACTIONS}
						className="h-150 w-full">
						<div className="flex flex-wrap items-center gap-2 pe-2">
							{/* the switcher is on: booking lives in the day view, but the week and month give the same appointments a wider context */}
							<EventCalendarNav className="min-w-0 flex-1" />
							<EventCalendarToolbar>
								<Button variant="outline" size="sm" onClick={showAgenda}>
									<ListIcon className="size-4" aria-hidden="true" />
									Agenda
								</Button>
								<Button size="sm" onClick={addAppointment}>
									<PlusIcon className="size-4" aria-hidden="true" />
									New appointment
								</Button>
							</EventCalendarToolbar>
						</div>
						<EventCalendarContent />
					</EventCalendar>
					<p className="border-t px-4 py-3 text-xs text-muted-foreground">
						Drag across an open time to book an appointment. Slots that overlap an existing booking are blocked.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
