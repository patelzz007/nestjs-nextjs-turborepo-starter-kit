import { MS_PER_MINUTE } from "@workspace/shared";
import type { CalendarEvent, EventCalendarOccurrence, EventCalendarSlotDraft, EventCalendarTone } from "@workspace/ui-kit-logic";
import { Button } from "@workspace/ui-native/components/button";
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui-native/components/dialog";
import { EventCalendar } from "@workspace/ui-native/components/event-calendar";
import { SegmentedControl, type SegmentedOption } from "@workspace/ui-native/components/segmented-control";
import { TextField } from "@workspace/ui-native/components/text-field";
import PlusIcon from "lucide-react-native/icons/plus";
import * as React from "react";

import { atHour, SAMPLE_CLOCK, SAMPLE_WEEKDAY } from "./event-calendar-sample";

const DEFAULT_START_HOUR = 9;

type Duration = "30" | "60" | "90" | "120";
const DURATIONS: readonly SegmentedOption<Duration>[] = [
	{ value: "30", label: "30m", accessibilityLabel: "30 minutes" },
	{ value: "60", label: "1h", accessibilityLabel: "1 hour" },
	{ value: "90", label: "1.5h", accessibilityLabel: "1.5 hours" },
	{ value: "120", label: "2h", accessibilityLabel: "2 hours" },
];

type ToneChoice = "blue" | "violet" | "green" | "yellow" | "red";
const TONES: readonly SegmentedOption<ToneChoice>[] = [
	{ value: "blue", label: "Blue" },
	{ value: "violet", label: "Violet" },
	{ value: "green", label: "Green" },
	{ value: "yellow", label: "Yellow" },
	{ value: "red", label: "Red" },
];

/** A week of meetings around the sample day. */
const EVENTS: readonly CalendarEvent[] = [
	{ id: "kickoff", title: "Project kickoff", start: atHour(1, 10), end: atHour(1, 11), color: "blue" },
	{ id: "1on1", title: "1:1 with Mia", start: atHour(2, 14), end: atHour(2, 15), color: "violet" },
	{ id: "review", title: "Design review", start: atHour(4, 11), end: atHour(4, 12), color: "green" },
	{ id: "standup", title: "Team standup", start: atHour(3, 9), end: atHour(3, 9.5), color: "yellow" },
	{ id: "interview", title: "Candidate interview", start: atHour(5, 13), end: atHour(5, 14), color: "red" },
	{ id: "retro", title: "Sprint retro", start: atHour(5, 16), end: atHour(5, 17), color: "violet" },
];

/** What the form edits: the event (null: a new one), its title, start, length and tone. */
interface Draft {
	readonly id: string | null;
	readonly title: string;
	readonly start: Date;
	readonly duration: Duration;
	readonly tone: ToneChoice;
}

function toneOf(tone: EventCalendarTone | undefined): ToneChoice {
	return TONES.find((option): boolean => option.value === tone)?.value ?? "blue";
}

function durationOf(event: CalendarEvent): Duration {
	const minutes = String(Math.round((event.end.getTime() - event.start.getTime()) / MS_PER_MINUTE));
	return DURATIONS.find((option): boolean => option.value === minutes)?.value ?? "60";
}

// One form for both: a tap on a free day (or the toolbar) opens it blank; a tap on an event edits or deletes it.
export function EventCalendar3Example(): React.JSX.Element {
	const [events, setEvents] = React.useState<readonly CalendarEvent[]>(EVENTS);
	const [draft, setDraft] = React.useState<Draft | null>(null);
	const openNew = React.useCallback((start: Date): void => {
		setDraft({ id: null, title: "", start, duration: "60", tone: "blue" });
	}, []);
	const handleSlot = React.useCallback(
		(slot: EventCalendarSlotDraft): void => {
			openNew(slot.allDay ? new Date(slot.start.getFullYear(), slot.start.getMonth(), slot.start.getDate(), DEFAULT_START_HOUR) : slot.start);
		},
		[openNew],
	);
	const handleToolbar = React.useCallback((): void => {
		openNew(atHour(SAMPLE_WEEKDAY, DEFAULT_START_HOUR));
	}, [openNew]);
	const handleEvent = React.useCallback((occurrence: EventCalendarOccurrence): void => {
		const { event } = occurrence;
		setDraft({ id: event.id, title: event.title, start: event.start, duration: durationOf(event), tone: toneOf(event.color) });
	}, []);
	const close = React.useCallback((): void => {
		setDraft(null);
	}, []);
	const setOpen = React.useCallback((open: boolean): void => {
		if (!open) {
			setDraft(null);
		}
	}, []);
	const save = React.useCallback((): void => {
		if (draft === null) {
			return;
		}
		const event: CalendarEvent = {
			id: draft.id ?? `event-${String(Date.now())}`,
			title: draft.title.trim() === "" ? "Untitled" : draft.title.trim(),
			start: draft.start,
			end: new Date(draft.start.getTime() + Number(draft.duration) * MS_PER_MINUTE),
			color: draft.tone,
		};
		setEvents((current): readonly CalendarEvent[] => (draft.id === null ? [...current, event] : current.map((item): CalendarEvent => (item.id === draft.id ? event : item))));
		setDraft(null);
	}, [draft]);
	const remove = React.useCallback((): void => {
		if (draft !== null && draft.id !== null) {
			setEvents((current): readonly CalendarEvent[] => current.filter((item): boolean => item.id !== draft.id));
		}
		setDraft(null);
	}, [draft]);
	const setTitle = React.useCallback((title: string): void => {
		setDraft((current): Draft | null => (current === null ? null : { ...current, title }));
	}, []);
	const setDuration = React.useCallback((duration: Duration): void => {
		setDraft((current): Draft | null => (current === null ? null : { ...current, duration }));
	}, []);
	const setTone = React.useCallback((tone: ToneChoice): void => {
		setDraft((current): Draft | null => (current === null ? null : { ...current, tone }));
	}, []);
	const toolbar = <Button label="New" icon={PlusIcon} size="sm" variant="outline" onPress={handleToolbar} />;
	return (
		<>
			<EventCalendar events={events} defaultView="month" clock={SAMPLE_CLOCK} onSlotPress={handleSlot} onEventPress={handleEvent} toolbarContent={toolbar} />
			<Dialog open={draft !== null} onOpenChange={setOpen} showCloseButton>
				<DialogHeader>
					<DialogTitle>{draft?.id === null ? "New event" : "Edit event"}</DialogTitle>
				</DialogHeader>
				<TextField label="Title" value={draft?.title ?? ""} onChange={setTitle} />
				<SegmentedControl label="Length" options={DURATIONS} value={draft?.duration ?? "60"} onChange={setDuration} />
				<SegmentedControl label="Colour" options={TONES} value={draft?.tone ?? "blue"} onChange={setTone} />
				<DialogFooter layout="row">
					{draft?.id === null ? (
						<Button label="Cancel" variant="outline" onPress={close} className="flex-1" />
					) : (
						<Button label="Delete" variant="destructive" onPress={remove} className="flex-1" />
					)}
					<Button label="Save" onPress={save} className="flex-1" />
				</DialogFooter>
			</Dialog>
		</>
	);
}
