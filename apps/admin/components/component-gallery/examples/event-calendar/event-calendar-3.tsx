"use client";

import { PlusIcon } from "lucide-react";
import * as React from "react";
import { EventCalendar } from "@workspace/ui/components/event-calendar/event-calendar";
import { EventCalendarContent } from "@workspace/ui/components/event-calendar/event-calendar-content";
import { EVENT_CALENDAR_TONE_STYLES } from "@workspace/ui/components/event-calendar/event-calendar-event";
import { EventCalendarNav, EventCalendarToolbar } from "@workspace/ui/components/event-calendar/event-calendar-nav";
import type {
	CalendarEvent,
	CalendarView,
	EventCalendarInteractions,
	EventCalendarOccurrence,
	EventCalendarSlotInfo,
	EventCalendarTone,
} from "@workspace/ui/components/event-calendar/event-calendar-types";
import { addDays, addMinutes, differenceInMinutes, format, setHours, startOfDay, startOfWeek } from "date-fns";

import { cn } from "@workspace/ui/lib/core/utils";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, type SelectOption } from "@workspace/ui/components/select";
import { Switch } from "@workspace/ui/components/switch";

/** The sample clock: Wednesday 17 June 2026, 09:30 local — fixed so the month always opens on the same week. */
const SAMPLE_NOW = new Date("2026-06-17T09:30:00");
const SUNDAY = 0;
const HALF_HOUR_MINUTES = 30;
const ALL_DAY_LENGTH_DAYS = 1;
/** The form offers start times on the hour, 07:00 through 19:00. */
const FIRST_START_HOUR = 7;
const START_HOUR_COUNT = 13;
const HOUR_LABEL_DIGITS = 2;
const DEFAULT_START_HOUR = 9;
const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_TONE: EventCalendarTone = "blue";

interface ToneOption {
	readonly tone: EventCalendarTone;
	readonly label: string;
}

const TONE_OPTIONS: readonly ToneOption[] = [
	{ tone: "blue", label: "Blue" },
	{ tone: "violet", label: "Violet" },
	{ tone: "green", label: "Green" },
	{ tone: "yellow", label: "Yellow" },
	{ tone: "red", label: "Red" },
];

function hourLabel(hour: number): string {
	return `${String(hour).padStart(HOUR_LABEL_DIGITS, "0")}:00`;
}

function buildStartHourOptions(): readonly SelectOption<number>[] {
	const options: SelectOption<number>[] = [];
	for (let hour = FIRST_START_HOUR; hour < FIRST_START_HOUR + START_HOUR_COUNT; hour += 1) {
		options.push({ value: hour, label: hourLabel(hour) });
	}
	return options;
}

const START_HOUR_OPTIONS: readonly SelectOption<number>[] = buildStartHourOptions();

const DURATION_OPTIONS: readonly SelectOption<number>[] = [
	{ value: 30, label: "30 min" },
	{ value: 60, label: "1 hour" },
	{ value: 90, label: "1.5 hours" },
	{ value: 120, label: "2 hours" },
];

const CANCEL_BUTTON: React.JSX.Element = <Button variant="outline" size="sm" />;

/** The dialog owns creation; drag/resize reschedules and persists. */
const INTERACTIONS: EventCalendarInteractions = { drag: true, resize: true, selectSlot: false };

/** The one dialog is a create form when `id` is null and an edit form otherwise - a single working copy the calendar clicks seed. */
interface EventDraft {
	readonly id: string | null;
	readonly title: string;
	readonly date: Date;
	readonly startHour: number;
	readonly duration: number;
	readonly allDay: boolean;
	readonly color: EventCalendarTone;
}

function atHour(week: Date, dayOffset: number, hour: number): Date {
	return setHours(addDays(week, dayOffset), hour);
}

function buildEvents(anchor: Date): readonly CalendarEvent[] {
	const week = startOfWeek(startOfDay(anchor), { weekStartsOn: SUNDAY });
	return [
		{ id: "kickoff", title: "Project kickoff", start: atHour(week, 1, 10), end: atHour(week, 1, 11), color: "blue" },
		{ id: "1on1", title: "1:1 with Mia", start: atHour(week, 2, 14), end: atHour(week, 2, 15), color: "violet" },
		{ id: "review", title: "Design review", start: atHour(week, 4, 11), end: atHour(week, 4, 12), color: "green" },
		{ id: "standup", title: "Team standup", start: atHour(week, 3, 9), end: addMinutes(atHour(week, 3, 9), HALF_HOUR_MINUTES), color: "yellow" },
		{ id: "interview", title: "Candidate interview", start: atHour(week, 5, 13), end: atHour(week, 5, 14), color: "red" },
		{ id: "retro", title: "Sprint retro", start: atHour(week, 5, 16), end: atHour(week, 5, 17), color: "violet" },
	];
}

const INITIAL_EVENTS: readonly CalendarEvent[] = buildEvents(SAMPLE_NOW);

function createDraft(date: Date): EventDraft {
	return { id: null, title: "", date: startOfDay(date), startHour: DEFAULT_START_HOUR, duration: DEFAULT_DURATION_MINUTES, allDay: false, color: DEFAULT_TONE };
}

function editDraft(event: CalendarEvent): EventDraft {
	return {
		id: event.id,
		title: event.title,
		date: startOfDay(event.start),
		startHour: event.start.getHours(),
		duration: Math.max(HALF_HOUR_MINUTES, differenceInMinutes(event.end, event.start)),
		allDay: event.allDay ?? false,
		color: event.color ?? DEFAULT_TONE,
	};
}

type DraftPatch = Partial<Omit<EventDraft, "id" | "date">>;

interface ToneSwatchProps {
	readonly option: ToneOption;
	readonly selected: boolean;
	readonly onSelect: (tone: EventCalendarTone) => void;
}

function ToneSwatch({ option, selected, onSelect }: ToneSwatchProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onSelect(option.tone);
	}, [onSelect, option.tone]);
	return (
		<button
			type="button"
			aria-label={option.label}
			aria-pressed={selected}
			onClick={handleClick}
			style={EVENT_CALENDAR_TONE_STYLES[option.tone]}
			className={cn("size-6 rounded-full bg-(--ec-event-color) ring-offset-background transition", selected && "ring-2 ring-ring ring-offset-2")}
		/>
	);
}

interface EventFormProps {
	readonly draft: EventDraft;
	readonly onChange: (patch: DraftPatch) => void;
	readonly onSave: () => void;
	readonly onRemove: () => void;
}

function EventForm({ draft, onChange, onSave, onRemove }: EventFormProps): React.JSX.Element {
	const titleRef = React.useRef<HTMLInputElement | null>(null);
	const isEdit = draft.id !== null;
	const canSave = draft.title.trim() !== "";

	const handleTitle = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange({ title: event.target.value });
		},
		[onChange],
	);
	const handleTone = React.useCallback(
		(color: EventCalendarTone): void => {
			onChange({ color });
		},
		[onChange],
	);
	const handleStartHour = React.useCallback(
		(startHour: number | null): void => {
			if (startHour !== null) {
				onChange({ startHour });
			}
		},
		[onChange],
	);
	const handleDuration = React.useCallback(
		(duration: number | null): void => {
			if (duration !== null) {
				onChange({ duration });
			}
		},
		[onChange],
	);
	const handleAllDay = React.useCallback(
		(allDay: boolean): void => {
			onChange({ allDay });
		},
		[onChange],
	);

	return (
		<DialogContent className="sm:max-w-sm" initialFocus={titleRef}>
			<DialogHeader>
				<DialogTitle>{isEdit ? "Edit event" : "New event"}</DialogTitle>
				<DialogDescription>{format(draft.date, "EEEE, MMMM d, yyyy")}</DialogDescription>
			</DialogHeader>

			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="ec-crud-title">Title</FieldLabel>
					<Input ref={titleRef} id="ec-crud-title" placeholder="Add a title" value={draft.title} onChange={handleTitle} />
				</Field>

				<Field>
					<FieldLabel>Color</FieldLabel>
					<div className="flex gap-2">
						{TONE_OPTIONS.map((option: ToneOption): React.JSX.Element => (
							<ToneSwatch key={option.tone} option={option} selected={draft.color === option.tone} onSelect={handleTone} />
						))}
					</div>
				</Field>

				{draft.allDay ? null : (
					<div className="grid grid-cols-2 gap-3">
						<Field>
							<FieldLabel htmlFor="ec-crud-start">Start</FieldLabel>
							<Select<number> items={START_HOUR_OPTIONS} value={draft.startHour} onValueChange={handleStartHour}>
								<SelectTrigger id="ec-crud-start" size="sm">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{START_HOUR_OPTIONS.map((option: SelectOption<number>): React.JSX.Element => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor="ec-crud-duration">Duration</FieldLabel>
							<Select<number> items={DURATION_OPTIONS} value={draft.duration} onValueChange={handleDuration}>
								<SelectTrigger id="ec-crud-duration" size="sm">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{DURATION_OPTIONS.map((option: SelectOption<number>): React.JSX.Element => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					</div>
				)}

				<Field orientation="horizontal">
					<FieldLabel htmlFor="ec-crud-allday" className="font-normal">
						All day
					</FieldLabel>
					<Switch id="ec-crud-allday" checked={draft.allDay} onCheckedChange={handleAllDay} />
				</Field>
			</FieldGroup>

			<DialogFooter className="sm:justify-between">
				{isEdit ? (
					<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onRemove}>
						Delete
					</Button>
				) : (
					<span />
				)}
				<div className="flex gap-2">
					<DialogClose render={CANCEL_BUTTON}>Cancel</DialogClose>
					<Button size="sm" onClick={onSave} disabled={!canSave}>
						{isEdit ? "Save changes" : "Create event"}
					</Button>
				</div>
			</DialogFooter>
		</DialogContent>
	);
}

function draftToRange(draft: EventDraft): Pick<CalendarEvent, "start" | "end" | "allDay"> {
	if (draft.allDay) {
		return { start: draft.date, end: addDays(draft.date, ALL_DAY_LENGTH_DAYS), allDay: true };
	}
	const start = setHours(draft.date, draft.startHour);
	return { start, end: addMinutes(start, draft.duration), allDay: false };
}

export function EventCalendar3Example(): React.JSX.Element {
	const [events, setEvents] = React.useState<readonly CalendarEvent[]>(INITIAL_EVENTS);
	const [view, setView] = React.useState<CalendarView>("month");
	const [date, setDate] = React.useState<Date>(SAMPLE_NOW);
	const counter = React.useRef(0);
	const [open, setOpen] = React.useState(false);
	const [draft, setDraft] = React.useState<EventDraft | null>(null);

	// Seed a blank create draft for a given day - shared by the empty-slot click and the header "Add event" button.
	const seedCreate = React.useCallback((day: Date): void => {
		setDraft(createDraft(day));
		setOpen(true);
	}, []);

	// Empty slot → create draft. Month cells report allDay with no `end`, so the form starts as a sensible timed event the user can adjust.
	const openCreate = React.useCallback(
		(slot: EventCalendarSlotInfo): void => {
			seedCreate(slot.date);
		},
		[seedCreate],
	);

	const openCreateToday = React.useCallback((): void => {
		seedCreate(SAMPLE_NOW);
	}, [seedCreate]);

	// Event click → seed an edit draft from the event itself (source of truth); preventDefault skips the built-in selection tint.
	const openEdit = React.useCallback((occurrence: EventCalendarOccurrence, event: React.MouseEvent<HTMLElement>): void => {
		event.preventDefault();
		setDraft(editDraft(occurrence.event));
		setOpen(true);
	}, []);

	const patchDraft = React.useCallback((patch: DraftPatch): void => {
		setDraft((current: EventDraft | null): EventDraft | null => (current === null ? null : { ...current, ...patch }));
	}, []);

	const save = React.useCallback((): void => {
		if (draft === null || draft.title.trim() === "") {
			return;
		}
		const fields = { ...draftToRange(draft), title: draft.title.trim(), color: draft.color };
		const editingId = draft.id;
		if (editingId === null) {
			counter.current += 1;
			const created: CalendarEvent = { id: `evt-${String(counter.current)}`, ...fields };
			setEvents((current: readonly CalendarEvent[]): readonly CalendarEvent[] => [...current, created]);
		} else {
			setEvents((current: readonly CalendarEvent[]): readonly CalendarEvent[] =>
				current.map((event: CalendarEvent): CalendarEvent => (event.id === editingId ? { ...event, ...fields } : event)),
			);
		}
		setOpen(false);
	}, [draft]);

	const remove = React.useCallback((): void => {
		const removingId = draft?.id ?? null;
		if (removingId === null) {
			return;
		}
		setEvents((current: readonly CalendarEvent[]): readonly CalendarEvent[] => current.filter((event: CalendarEvent): boolean => event.id !== removingId));
		setOpen(false);
	}, [draft]);

	return (
		<div className="w-full p-4">
			<Card className="w-full py-0">
				<CardContent className="p-0">
					<EventCalendar
						events={events}
						onEventsChange={setEvents}
						view={view}
						onViewChange={setView}
						date={date}
						onDateChange={setDate}
						now={SAMPLE_NOW}
						onSlotClick={openCreate}
						onEventClick={openEdit}
						interactions={INTERACTIONS}
						className="h-160 w-full">
						<div className="flex flex-wrap items-center gap-2 pe-2">
							<EventCalendarNav className="min-w-0 flex-1" />
							<EventCalendarToolbar>
								<Button size="sm" onClick={openCreateToday}>
									<PlusIcon className="size-4" aria-hidden="true" />
									Add event
								</Button>
							</EventCalendarToolbar>
						</div>
						<EventCalendarContent />
					</EventCalendar>
				</CardContent>
			</Card>

			<Dialog open={open} onOpenChange={setOpen}>
				{draft === null ? null : <EventForm draft={draft} onChange={patchDraft} onSave={save} onRemove={remove} />}
			</Dialog>
		</div>
	);
}
