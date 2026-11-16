// The native Gantt's own rules, beside the ones it shares with the web (@workspace/ui-kit-logic `gantt`: ranges,
// axes, rows, bars, baselines, dependencies, recurrence): its English copy, the colour classes a bar's `color`
// names, how a bar steps when moved or resized by a button or a screen reader's action, and what a bar says.

import { addDays, addMinutes, format } from "date-fns";
import {
	MINUTES_PER_DAY,
	MINUTES_PER_HOUR,
	toZoned,
	zonedStartOfDay,
	GANTT_LABELS_EN,
	type GanttEvent,
	type GanttLabels,
	type GanttResource,
	type GanttScale,
} from "@workspace/ui-kit-logic";

/** The copy a phone adds: the buttons and actions that stand in for dragging a bar's edges. */
export interface NativeGanttLabels {
	readonly moveEarlier: string;
	readonly moveLater: string;
	readonly shorten: string;
	readonly lengthen: string;
	readonly moveRowUp: string;
	readonly moveRowDown: string;
	readonly collapse: (title: string) => string;
	readonly expand: (title: string) => string;
	readonly clearSelection: string;
}

/** The kit's copy: the shared English, with a phone's words for what a mouse and keyboard do on the web. */
export const DEFAULT_GANTT_LABELS: GanttLabels & NativeGanttLabels = {
	...GANTT_LABELS_EN,
	scheduleHint: "Tap to add a schedule",
	scheduleHintDrag: "Tap to add a schedule",
	barKeyboardHint: "Use the actions to move it or change its end.",
	moveEarlier: "Move earlier",
	moveLater: "Move later",
	shorten: "Shorten",
	lengthen: "Lengthen",
	moveRowUp: "Move up",
	moveRowDown: "Move down",
	collapse: (title: string): string => `Collapse ${title}`,
	expand: (title: string): string => `Expand ${title}`,
	clearSelection: "Done",
};

export type NativeGanttLabelSet = GanttLabels & NativeGanttLabels;

/** The minutes one step covers, for turning a drag's distance into steps. */
export function ganttStepMinutes(event: Pick<GanttEvent, "allDay">, scale: GanttScale): number {
	return (event.allDay ?? false) || scale !== "day" ? MINUTES_PER_DAY : MINUTES_PER_HOUR;
}

/** A row's place among its siblings: its parent's id (null at the top) and its index, or null when it is not in the tree. */
export function ganttSiblingPosition(
	resources: readonly GanttResource[],
	id: string,
	parentId: string | null = null,
): { readonly parentId: string | null; readonly index: number; readonly count: number } | null {
	const index = resources.findIndex((resource): boolean => resource.id === id);
	if (index !== NOT_FOUND) {
		return { parentId, index, count: resources.length };
	}
	for (const resource of resources) {
		const found = ganttSiblingPosition(resource.children ?? [], id, resource.id);
		if (found !== null) {
			return found;
		}
	}
	return null;
}

/** Index of a list position that does not exist, as `findIndex` reports it. */
const NOT_FOUND = -1;

/** The tones a bar's `color` names (the theme's categorical tones), as fill classes. */
const TONE_CLASSES: Readonly<Record<string, string>> = {
	blue: "bg-tone-blue",
	teal: "bg-tone-teal",
	violet: "bg-tone-violet",
	red: "bg-tone-red",
	green: "bg-tone-green",
	yellow: "bg-tone-yellow",
	orange: "bg-tone-orange",
	primary: "bg-primary",
	muted: "bg-muted-foreground",
};

/** A bar's fill class: its `color` as a tone name ("blue"), else the primary colour. */
export function ganttToneClass(color: string | undefined): string {
	return (color === undefined ? undefined : TONE_CLASSES[color]) ?? "bg-primary";
}

/** What a step changes: the whole bar, or its end. */
export type GanttStepKind = "move" | "end";

/**
 * The bar's new window after `steps` steps (negative: earlier or shorter), each an hour of a timed bar on the day
 * scale and a day otherwise: a move shifts both ends, an end step changes the length, never below one step.
 * All-day bars step by whole days in the display zone, so a daylight-saving change keeps them on midnight.
 */
export function stepGanttEvent(
	event: Pick<GanttEvent, "start" | "end" | "allDay">,
	kind: GanttStepKind,
	steps: number,
	scale: GanttScale,
	timeZone: string,
): { readonly start: Date; readonly end: Date } {
	const allDay = event.allDay ?? false;
	const shift = (date: Date, count: number): Date =>
		allDay || scale !== "day" ? zonedStartOfDay(addDays(toZoned(date, timeZone), count), timeZone) : addMinutes(date, count * MINUTES_PER_HOUR);
	if (kind === "move") {
		return { start: shift(event.start, steps), end: shift(event.end, steps) };
	}
	const end = shift(event.end, steps);
	return { start: event.start, end: end.getTime() <= event.start.getTime() ? event.end : end };
}

/** A bar's dates as a person reads them: "Jun 14 – Jun 17", the end being the last day it covers. */
export function ganttDateRangeLabel(event: Pick<GanttEvent, "start" | "end" | "allDay">, labels: Pick<GanttLabels, "formats" | "rangeSeparator">, timeZone: string): string {
	const allDay = event.allDay ?? false;
	const lastDay = allDay ? addDays(toZoned(event.end, timeZone), -1) : toZoned(event.end, timeZone);
	const pattern = allDay ? labels.formats.shortDate : labels.formats.dateTime;
	const from = format(toZoned(event.start, timeZone), pattern);
	const to = format(lastDay.getTime() < event.start.getTime() ? toZoned(event.start, timeZone) : lastDay, pattern);
	return from === to ? from : `${from}${labels.rangeSeparator}${to}`;
}
