"use client";

// Ported from ReUI (https://reui.io/r/base-vega/event-calendar-dnd.json): the
// pointer gesture engine — move, resize and drag-to-create — plus the proposal
// maths behind it. `useEventCalendarGestures` keeps ReUI's name and its
// `beginMove` / `beginResize` / `beginCreate` / `canDrag` / `canResize` surface.
// Deviations:
// - The maths is split out as pure, exported, unit-tested functions
//   (`computeTimedMove`, `computeDayMove`, `computeTimedResize`,
//   `computeDayResize`, `computeTimedDraft`, `computeDayDraft`,
//   `pointerToMinutes`, plus the keyboard counterparts
//   `resolveKeyboardIntent` / `applyKeyboardIntent`). The hook only measures
//   the DOM and feeds pointer positions into them.
// - Gesture bookkeeping (the click-after-drag guard, the chip-press guard)
//   lives on the calendar instance instead of module globals, so two
//   calendars on one page never share it.
// - Not ported: the cursor-attached carry clone, edge auto-scroll, touch
//   long-press delay and the floating "can't place here" pill — the in-grid
//   ghost marks the drop target (dashed, destructive when invalid) and the
//   announcer reads `labels.dropNotAllowed`.
// - A drag keeps the event's kind: a timed event moves in minutes on the time
//   grid and by whole days in the month grid; all-day/multi-day bars move by
//   whole days. Converting between timed and all-day by dropping on the other
//   lane is not supported.
import { addDays, addMinutes, differenceInCalendarDays } from "date-fns";
import * as React from "react";

import { useEventCalendar, type EventCalendarContextValue } from "./event-calendar";
import { addZonedDays, isBarOccurrence, minutesToInstant, snapMinutes, toZoned, zonedStartOfDay } from "./event-calendar-lib";
import type {
	CalendarView,
	EventCalendarDateRange,
	EventCalendarDragKind,
	EventCalendarDragState,
	EventCalendarOccurrence,
	EventCalendarProposedUpdate,
	EventCalendarSegment,
	EventCalendarSlotDraft,
} from "./event-calendar-types";

export { EVENT_CALENDAR_ACTIVATION } from "./event-calendar";

const PRIMARY_POINTER_BUTTON = 0;
/** Days the vertical arrow keys step in a day-granular grid (one week row). */
const KEYBOARD_ROW_DAYS = 7;

/** A drag edge; "start" resizes the beginning, "end" the end. */
export type EventCalendarResizeEdge = "start" | "end";

function plainDate(date: Date): Date {
	return new Date(date.getTime());
}

/** Minutes from the top of a day column at `clientY`, clamped to the column's minute bounds. */
export function pointerToMinutes(rect: { readonly top: number; readonly height: number }, clientY: number, boundsStartMin: number, boundsEndMin: number): number {
	const boundsMinutes = Math.max(1, boundsEndMin - boundsStartMin);
	const pxPerMinute = rect.height > 0 ? rect.height / boundsMinutes : 1;
	const minutes = boundsStartMin + (clientY - rect.top) / pxPerMinute;
	return Math.min(Math.max(minutes, boundsStartMin), boundsEndMin);
}

/** A timed move: whole days in wall time, then snapped minutes; duration preserved. */
export function computeTimedMove(range: EventCalendarDateRange, dayDelta: number, minuteDelta: number, snap: number, timeZone: string): EventCalendarDateRange {
	const durationMs = range.end.getTime() - range.start.getTime();
	const start = plainDate(addMinutes(addDays(toZoned(range.start, timeZone), dayDelta), snapMinutes(minuteDelta, snap)));
	return { start, end: new Date(start.getTime() + durationMs) };
}

/** A day-granular move: both edges shift by whole wall-time days (midnights stay midnights). */
export function computeDayMove(range: EventCalendarDateRange, dayDelta: number, timeZone: string): EventCalendarDateRange {
	return { start: plainDate(addDays(toZoned(range.start, timeZone), dayDelta)), end: plainDate(addDays(toZoned(range.end, timeZone), dayDelta)) };
}

/** A timed resize to `targetMinutes` of `targetDay`; the event never shrinks below one snap step. */
export function computeTimedResize(
	range: EventCalendarDateRange,
	edge: EventCalendarResizeEdge,
	targetDay: Date,
	targetMinutes: number,
	snap: number,
	timeZone: string,
): EventCalendarDateRange {
	const instant = minutesToInstant(targetDay, snapMinutes(targetMinutes, snap), timeZone);
	if (edge === "end") {
		const minimumEnd = addMinutes(range.start, snap);
		return { start: range.start, end: instant > minimumEnd ? instant : minimumEnd };
	}
	const maximumStart = addMinutes(range.end, -snap);
	return { start: instant < maximumStart ? instant : maximumStart, end: range.end };
}

/** A day-granular resize by whole days; the event never shrinks below one day. */
export function computeDayResize(range: EventCalendarDateRange, edge: EventCalendarResizeEdge, dayDelta: number, timeZone: string): EventCalendarDateRange {
	if (edge === "end") {
		const end = addDays(toZoned(range.end, timeZone), dayDelta);
		const minimumEnd = addDays(toZoned(range.start, timeZone), 1);
		return { start: range.start, end: plainDate(end > minimumEnd ? end : minimumEnd) };
	}
	const start = addDays(toZoned(range.start, timeZone), dayDelta);
	const maximumStart = addDays(toZoned(range.end, timeZone), -1);
	return { start: plainDate(start < maximumStart ? start : maximumStart), end: range.end };
}

/** A drag-create rectangle inside one day column: snapped, at least one snap step, clamped to the bounds. */
export function computeTimedDraft(
	day: Date,
	anchorMinutes: number,
	currentMinutes: number,
	snap: number,
	bounds: { readonly startMin: number; readonly endMin: number },
	timeZone: string,
): EventCalendarDateRange {
	const anchor = snapMinutes(anchorMinutes, snap);
	const current = snapMinutes(currentMinutes, snap);
	const low = Math.max(Math.min(anchor, current), bounds.startMin);
	const high = Math.min(Math.max(Math.max(anchor, current), low + snap), bounds.endMin);
	return { start: minutesToInstant(day, Math.min(low, high - snap), timeZone), end: minutesToInstant(day, high, timeZone) };
}

/** A drag-create across whole days: from the earlier day's midnight to the day after the later one. */
export function computeDayDraft(anchorDay: Date, currentDay: Date, timeZone: string): EventCalendarDateRange {
	const anchor = zonedStartOfDay(anchorDay, timeZone);
	const current = zonedStartOfDay(currentDay, timeZone);
	const first = anchor < current ? anchor : current;
	const last = anchor < current ? current : anchor;
	return { start: plainDate(first), end: plainDate(addZonedDays(last, 1, timeZone)) };
}

/** Calendar days from `from` to `to` in the display zone. */
export function calendarDayDelta(from: Date, to: Date, timeZone: string): number {
	return differenceInCalendarDays(toZoned(to, timeZone), toZoned(from, timeZone));
}

/** What a keyboard shortcut on a focused event asks for. */
export interface EventCalendarKeyboardIntent {
	readonly kind: "move" | "resize-end";
	readonly dayDelta: number;
	readonly minuteDelta: number;
}

/** How fine a grid is: minute rows (time grid) or whole days (month, all-day lane). */
export type EventCalendarGranularity = "minute" | "day";

/**
 * Alt+Arrow moves the focused event (Left/Right a day, Up/Down one snap step
 * in a time grid or one week in a day grid); Alt+Shift+Arrow resizes its end.
 */
export function resolveKeyboardIntent(
	key: string,
	modifiers: { readonly altKey: boolean; readonly shiftKey: boolean },
	granularity: EventCalendarGranularity,
	snap: number,
): EventCalendarKeyboardIntent | null {
	if (!modifiers.altKey) {
		return null;
	}
	const kind = modifiers.shiftKey ? "resize-end" : "move";
	const vertical = granularity === "minute" ? { dayDelta: 0, minuteDelta: snap } : { dayDelta: KEYBOARD_ROW_DAYS, minuteDelta: 0 };
	switch (key) {
		case "ArrowLeft":
			return { kind, dayDelta: -1, minuteDelta: 0 };
		case "ArrowRight":
			return { kind, dayDelta: 1, minuteDelta: 0 };
		case "ArrowUp":
			return { kind, dayDelta: -vertical.dayDelta, minuteDelta: -vertical.minuteDelta };
		case "ArrowDown":
			return { kind, dayDelta: vertical.dayDelta, minuteDelta: vertical.minuteDelta };
		default:
			return null;
	}
}

/** The range a keyboard intent produces. */
export function applyKeyboardIntent(
	range: EventCalendarDateRange,
	intent: EventCalendarKeyboardIntent,
	granularity: EventCalendarGranularity,
	snap: number,
	timeZone: string,
): EventCalendarDateRange {
	if (intent.kind === "move") {
		return granularity === "day" ? computeDayMove(range, intent.dayDelta, timeZone) : computeTimedMove(range, intent.dayDelta, intent.minuteDelta, snap, timeZone);
	}
	if (granularity === "day" || intent.minuteDelta === 0) {
		return computeDayResize(range, "end", intent.dayDelta, timeZone);
	}
	const minimumEnd = addMinutes(range.start, snap);
	const end = addMinutes(range.end, snapMinutes(intent.minuteDelta, snap));
	return { start: range.start, end: end > minimumEnd ? end : minimumEnd };
}

/** The proposal a gesture shows and commits. */
export function proposalToUpdate(drag: EventCalendarDragState): EventCalendarProposedUpdate {
	const source = drag.kind === "move" ? "drag" : drag.kind;
	return {
		event: drag.occurrence.event,
		occurrence: drag.occurrence,
		start: drag.proposedStart,
		end: drag.proposedEnd,
		allDay: drag.proposedAllDay,
		source,
		...(drag.proposedResourceId === undefined ? {} : { resourceId: drag.proposedResourceId }),
	};
}

/** Whether an occurrence may be moved / resized under the current interactions. */
export function isOccurrenceDraggable(occurrence: EventCalendarOccurrence, interactionOn: boolean, gesture: "move" | "resize"): boolean {
	const { event } = occurrence;
	const perEvent = gesture === "move" ? event.draggable : event.resizable;
	return interactionOn && event.readOnly !== true && perEvent !== false;
}

interface TimeColumnRect {
	readonly day: Date;
	readonly rect: DOMRect;
	readonly boundsStartMin: number;
	readonly boundsEndMin: number;
	readonly resourceId?: string;
}

interface DayCellRect {
	readonly day: Date;
	readonly rect: DOMRect;
	readonly resourceId?: string;
}

interface Surface {
	readonly columns: readonly TimeColumnRect[];
	readonly cells: readonly DayCellRect[];
}

function readNumber(value: string | undefined): number | undefined {
	if (value === undefined || value === "") {
		return undefined;
	}
	const parsed = Number(value);
	return Number.isNaN(parsed) ? undefined : parsed;
}

/** Measures every day column / day cell of the calendar once, at gesture activation. */
function collectSurface(root: HTMLElement | null): Surface {
	const columns: TimeColumnRect[] = [];
	const cells: DayCellRect[] = [];
	for (const element of root?.querySelectorAll<HTMLElement>("[data-ec-day]") ?? []) {
		const dayMs = readNumber(element.dataset.ecDay);
		if (dayMs === undefined) {
			continue;
		}
		const day = new Date(dayMs);
		const rect = element.getBoundingClientRect();
		const resource = element.dataset.ecResource === undefined ? {} : { resourceId: element.dataset.ecResource };
		const boundsStartMin = readNumber(element.dataset.ecBoundsStart);
		const boundsEndMin = readNumber(element.dataset.ecBoundsEnd);
		if (boundsStartMin === undefined || boundsEndMin === undefined) {
			cells.push({ day, rect, ...resource });
		} else {
			columns.push({ day, rect, boundsStartMin, boundsEndMin, ...resource });
		}
	}
	return { columns, cells };
}

function horizontalDistance(rect: DOMRect, clientX: number): number {
	if (clientX >= rect.left && clientX < rect.right) {
		return 0;
	}
	return Math.min(Math.abs(clientX - rect.left), Math.abs(clientX - rect.right));
}

/** The column under `clientX`, else the horizontally nearest one. */
function findColumn(surface: Surface, clientX: number): TimeColumnRect | undefined {
	let best: TimeColumnRect | undefined;
	for (const column of surface.columns) {
		if (best === undefined || horizontalDistance(column.rect, clientX) < horizontalDistance(best.rect, clientX)) {
			best = column;
		}
	}
	return best;
}

function findCell(surface: Surface, clientX: number, clientY: number): DayCellRect | undefined {
	return surface.cells.find((cell: DayCellRect): boolean => clientX >= cell.rect.left && clientX < cell.rect.right && clientY >= cell.rect.top && clientY < cell.rect.bottom);
}

interface PointerPoint {
	readonly clientX: number;
	readonly clientY: number;
}

function travelled(from: PointerPoint, to: PointerPoint): number {
	return Math.hypot(to.clientX - from.clientX, to.clientY - from.clientY);
}

/** Wires window listeners for one pointer gesture; `onActivate` / `onMove` / `onEnd` receive pointer points. */
function trackPointer(
	startEvent: PointerEvent,
	activationDistance: number,
	handlers: {
		readonly onActivate: (point: PointerPoint) => boolean;
		readonly onMove: (point: PointerPoint) => void;
		readonly onEnd: (committed: boolean) => void;
	},
): void {
	const { pointerId } = startEvent;
	let activated = false;
	let finished = false;
	const finish = (committed: boolean): void => {
		if (finished) {
			return;
		}
		finished = true;
		window.removeEventListener("pointermove", handleMove);
		window.removeEventListener("pointerup", handleUp);
		window.removeEventListener("pointercancel", handleCancel);
		window.removeEventListener("keydown", handleKey, true);
		window.removeEventListener("blur", handleBlur);
		if (activated) {
			handlers.onEnd(committed);
		}
	};
	const handleMove = (event: PointerEvent): void => {
		if (event.pointerId !== pointerId) {
			return;
		}
		if (!activated) {
			if (travelled(startEvent, event) < activationDistance) {
				return;
			}
			activated = handlers.onActivate(startEvent);
			if (!activated) {
				finish(false);
				return;
			}
		}
		handlers.onMove(event);
	};
	const handleUp = (event: PointerEvent): void => {
		if (event.pointerId === pointerId) {
			finish(true);
		}
	};
	const handleCancel = (event: PointerEvent): void => {
		if (event.pointerId === pointerId) {
			finish(false);
		}
	};
	const handleKey = (event: KeyboardEvent): void => {
		if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			finish(false);
		}
	};
	const handleBlur = (): void => {
		finish(false);
	};
	window.addEventListener("pointermove", handleMove);
	window.addEventListener("pointerup", handleUp);
	window.addEventListener("pointercancel", handleCancel);
	window.addEventListener("keydown", handleKey, true);
	window.addEventListener("blur", handleBlur);
}

function dragKey(drag: EventCalendarDragState): string {
	return `${drag.kind}:${String(drag.proposedStart.getTime())}:${String(drag.proposedEnd.getTime())}:${drag.proposedResourceId ?? ""}:${String(drag.valid)}`;
}

interface EventGestureOrigin {
	readonly surface: Surface;
	readonly column: TimeColumnRect | undefined;
	readonly cell: DayCellRect | undefined;
	readonly minutes: number;
}

function resolveOrigin(surface: Surface, point: PointerPoint, preferDays: boolean): EventGestureOrigin {
	const cell = findCell(surface, point.clientX, point.clientY);
	const column = preferDays && cell !== undefined ? undefined : findColumn(surface, point.clientX);
	const minutes = column === undefined ? 0 : pointerToMinutes(column.rect, point.clientY, column.boundsStartMin, column.boundsEndMin);
	return { surface, column, cell: column === undefined ? cell : undefined, minutes };
}

interface ProposalInput {
	readonly calendar: EventCalendarContextValue;
	readonly kind: EventCalendarDragKind;
	readonly segment: EventCalendarSegment;
	readonly origin: EventGestureOrigin;
	readonly point: PointerPoint;
}

/** The drag proposal for the pointer at `point`, or null when it is over nothing usable. */
function proposeDrag({ calendar, kind, segment, origin, point }: ProposalInput): EventCalendarDragState | null {
	const { timeZone, snapDuration } = calendar.settings;
	const { occurrence } = segment;
	let range: EventCalendarDateRange;
	let resourceId: string | undefined;
	let dayGranular: boolean;
	if (origin.column !== undefined) {
		const column = findColumn(origin.surface, point.clientX);
		if (column === undefined) {
			return null;
		}
		const minutes = pointerToMinutes(column.rect, point.clientY, column.boundsStartMin, column.boundsEndMin);
		const dayDelta = calendarDayDelta(origin.column.day, column.day, timeZone);
		range =
			kind === "move"
				? computeTimedMove(occurrence, dayDelta, minutes - origin.minutes, snapDuration, timeZone)
				: computeTimedResize(occurrence, kind === "resize-end" ? "end" : "start", column.day, minutes, snapDuration, timeZone);
		resourceId = column.resourceId;
		dayGranular = false;
	} else if (origin.cell !== undefined) {
		const cell = findCell(origin.surface, point.clientX, point.clientY);
		if (cell === undefined) {
			return null;
		}
		const dayDelta = calendarDayDelta(origin.cell.day, cell.day, timeZone);
		range = kind === "move" ? computeDayMove(occurrence, dayDelta, timeZone) : computeDayResize(occurrence, kind === "resize-end" ? "end" : "start", dayDelta, timeZone);
		resourceId = cell.resourceId;
		dayGranular = true;
	} else {
		return null;
	}
	const draft: EventCalendarDragState = {
		kind,
		occurrence,
		proposedStart: range.start,
		proposedEnd: range.end,
		proposedAllDay: occurrence.allDay,
		proposedDayGranular: dayGranular,
		valid: true,
		...(resourceId === undefined || resourceId === occurrence.event.resourceId ? {} : { proposedResourceId: resourceId }),
	};
	return { ...draft, valid: calendar.internals.canDrop(proposalToUpdate(draft)) };
}

export interface EventCalendarGestures {
	readonly beginMove: (event: React.PointerEvent<HTMLElement>, segment: EventCalendarSegment) => void;
	readonly beginResize: (event: React.PointerEvent<HTMLElement>, segment: EventCalendarSegment, edge: EventCalendarResizeEdge) => void;
	readonly beginCreate: (event: React.PointerEvent<HTMLElement>, day: Date, allDay: boolean, resourceId?: string) => void;
	readonly canDrag: (segment: EventCalendarSegment) => boolean;
	readonly canResize: (segment: EventCalendarSegment) => boolean;
}

function blockedGesture(calendar: EventCalendarContextValue, startEvent: PointerEvent, segment: EventCalendarSegment, gesture: "move" | "resize"): void {
	const { event } = segment.occurrence;
	const perEvent = gesture === "move" ? event.draggable : event.resizable;
	const reason = event.readOnly === true ? "readOnly" : perEvent === false ? "disabled" : "interactions-off";
	trackPointer(startEvent, calendar.settings.activation.moveDistancePx, {
		onActivate: (): boolean => {
			calendar.internals.dragBlocked(segment.occurrence, { gesture, reason });
			calendar.internals.announce(calendar.settings.i18n.labels.dropNotAllowed);
			return true;
		},
		onMove: (): void => {
			return;
		},
		onEnd: (): void => {
			calendar.internals.markGestureEnd();
		},
	});
}

function eventGesture(calendar: EventCalendarContextValue, startEvent: PointerEvent, segment: EventCalendarSegment, kind: EventCalendarDragKind): void {
	const preferDays = isBarOccurrence(segment.occurrence, calendar.settings.timeZone);
	let origin: EventGestureOrigin | null = null;
	let current: EventCalendarDragState | null = null;
	let currentKey = "";
	trackPointer(startEvent, calendar.settings.activation.moveDistancePx, {
		onActivate: (point: PointerPoint): boolean => {
			origin = resolveOrigin(collectSurface(calendar.internals.getRootElement()), point, preferDays);
			return origin.column !== undefined || origin.cell !== undefined;
		},
		onMove: (point: PointerPoint): void => {
			if (origin === null) {
				return;
			}
			const next = proposeDrag({ calendar, kind, segment, origin, point });
			if (next === null) {
				return;
			}
			const key = dragKey(next);
			if (key !== currentKey) {
				currentKey = key;
				current = next;
				calendar.internals.setDrag(next);
			}
		},
		onEnd: (committed: boolean): void => {
			const proposal = current;
			calendar.internals.setDrag(null);
			calendar.internals.markGestureEnd();
			if (!committed || proposal === null) {
				return;
			}
			if (!proposal.valid) {
				calendar.internals.announce(calendar.settings.i18n.labels.dropNotAllowed);
				return;
			}
			calendar.internals.applyProposedUpdate(proposalToUpdate(proposal));
		},
	});
}

function createGesture(calendar: EventCalendarContextValue, startEvent: PointerEvent, day: Date, allDay: boolean, view: CalendarView, resourceId: string | undefined): void {
	const { timeZone, snapDuration } = calendar.settings;
	let surface: Surface | null = null;
	let anchorMinutes = 0;
	let current: EventCalendarSlotDraft | null = null;
	const resource = resourceId === undefined ? {} : { resourceId };
	const sameColumn = (column: TimeColumnRect): boolean => column.day.getTime() === zonedStartOfDay(day, timeZone).getTime() && column.resourceId === resourceId;
	trackPointer(startEvent, calendar.settings.activation.createDistancePx, {
		onActivate: (point: PointerPoint): boolean => {
			surface = collectSurface(calendar.internals.getRootElement());
			if (!allDay) {
				const column = surface.columns.find(sameColumn);
				if (column === undefined) {
					return false;
				}
				anchorMinutes = pointerToMinutes(column.rect, point.clientY, column.boundsStartMin, column.boundsEndMin);
			}
			return true;
		},
		onMove: (point: PointerPoint): void => {
			if (surface === null) {
				return;
			}
			let range: EventCalendarDateRange | null = null;
			if (allDay) {
				const cell = findCell(surface, point.clientX, point.clientY);
				range = cell === undefined ? null : computeDayDraft(day, cell.day, timeZone);
			} else {
				const column = surface.columns.find(sameColumn);
				range =
					column === undefined
						? null
						: computeTimedDraft(
								day,
								anchorMinutes,
								pointerToMinutes(column.rect, point.clientY, column.boundsStartMin, column.boundsEndMin),
								snapDuration,
								{ startMin: column.boundsStartMin, endMin: column.boundsEndMin },
								timeZone,
							);
			}
			if (range === null) {
				return;
			}
			const draft: EventCalendarSlotDraft = { start: range.start, end: range.end, allDay, view, ...resource };
			if (calendar.internals.canSelectSlot(draft)) {
				current = draft;
				calendar.internals.setSlotDraft(draft);
			}
		},
		onEnd: (committed: boolean): void => {
			const draft = current;
			calendar.internals.setSlotDraft(null);
			calendar.internals.markGestureEnd();
			if (committed && draft !== null) {
				calendar.internals.commitSlotDraft(draft);
			}
		},
	});
}

/** Pointer gestures for the event chips and the empty grid of the current calendar. */
export function useEventCalendarGestures(): EventCalendarGestures {
	const calendar = useEventCalendar();
	const { interactions, view } = calendar.state;

	const canDrag = React.useCallback((segment: EventCalendarSegment): boolean => isOccurrenceDraggable(segment.occurrence, interactions.drag, "move"), [interactions.drag]);
	const canResize = React.useCallback(
		(segment: EventCalendarSegment): boolean => isOccurrenceDraggable(segment.occurrence, interactions.resize, "resize"),
		[interactions.resize],
	);

	const beginMove = React.useCallback(
		(event: React.PointerEvent<HTMLElement>, segment: EventCalendarSegment): void => {
			if (event.button !== PRIMARY_POINTER_BUTTON) {
				return;
			}
			if (!canDrag(segment)) {
				blockedGesture(calendar, event.nativeEvent, segment, "move");
				return;
			}
			eventGesture(calendar, event.nativeEvent, segment, "move");
		},
		[calendar, canDrag],
	);

	const beginResize = React.useCallback(
		(event: React.PointerEvent<HTMLElement>, segment: EventCalendarSegment, edge: EventCalendarResizeEdge): void => {
			if (event.button !== PRIMARY_POINTER_BUTTON) {
				return;
			}
			event.stopPropagation();
			if (!canResize(segment)) {
				blockedGesture(calendar, event.nativeEvent, segment, "resize");
				return;
			}
			event.preventDefault();
			eventGesture(calendar, event.nativeEvent, segment, edge === "start" ? "resize-start" : "resize-end");
		},
		[calendar, canResize],
	);

	const beginCreate = React.useCallback(
		(event: React.PointerEvent<HTMLElement>, day: Date, allDay: boolean, resourceId?: string): void => {
			if (event.button !== PRIMARY_POINTER_BUTTON || !interactions.selectSlot) {
				return;
			}
			createGesture(calendar, event.nativeEvent, day, allDay, view, resourceId);
		},
		[calendar, interactions.selectSlot, view],
	);

	return React.useMemo((): EventCalendarGestures => ({ beginMove, beginResize, beginCreate, canDrag, canResize }), [beginMove, beginResize, beginCreate, canDrag, canResize]);
}
