"use client";

// Ported from ReUI (https://reui.io/r/base-vega/event-calendar-event.json): the
// one interactive event element of every view — selection, clicks, drag and
// resize wiring and the consumer render slot. `EventCalendarEvent`, its
// `segment` / `children` / `preview` props, `useEventCalendarEventChip` and the
// shared surface class tables keep ReUI's names. Deviations:
// - Event colours are tones: `--ec-event-color` resolves from
//   `CalendarEvent.color` through `EVENT_CALENDAR_TONE_COLORS` (semantic
//   `--tone-*` tokens), and `EVENT_CALENDAR_COLORS` lists those tones instead of
//   raw palette colours; tone names come from `labels.toneNames`.
// - The chip look is a CVA (`eventCalendarEventVariants`: `variant` chip /
//   block / bar / agenda, `size`, `state`) instead of inline class soup.
// - Keyboard moves: with a chip focused, Alt+Arrow moves the event (a day, or
//   one snap step on the time grid / one week on a day grid) and Alt+Shift+Arrow
//   resizes its end; the commit goes through `onEventUpdate` with
//   `source: "keyboard"`, is announced, and focus follows the re-keyed chip.
// - `render` (Base UI useRender) and the styled hover tooltip are not ported;
//   the native `title` carries the label.
import { assignRef } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva } from "class-variance-authority";
import { format } from "date-fns";
import { RepeatIcon } from "lucide-react";
import * as React from "react";

import {
	useEventCalendar,
	useEventCalendarDraggingKey,
	useEventCalendarNow,
	useEventCalendarViewConfig,
	useEventCalendarViewContext,
	type EventCalendarRenderEventProps,
} from "./event-calendar";
import { applyKeyboardIntent, resolveKeyboardIntent, useEventCalendarGestures, type EventCalendarGranularity, type EventCalendarResizeEdge } from "./event-calendar-dnd";
import { addZonedDays, isBarOccurrence, toZoned, zonedStartOfDay } from "./event-calendar-lib";
import type { CalendarView, EventCalendarOccurrence, EventCalendarProposedUpdate, EventCalendarSegment, EventCalendarTone } from "./event-calendar-types";

/** The CSS colour each event tone paints — semantic tokens only, so both themes keep contrast. */
export const EVENT_CALENDAR_TONE_COLORS: Readonly<Record<EventCalendarTone, string>> = {
	brand: "var(--primary)",
	neutral: "var(--muted-foreground)",
	blue: "var(--tone-blue)",
	green: "var(--tone-green)",
	violet: "var(--tone-violet)",
	red: "var(--tone-red)",
	yellow: "var(--tone-yellow)",
	teal: "var(--tone-teal)",
	orange: "var(--tone-orange)",
};

export interface EventCalendarColorOption {
	readonly name: EventCalendarTone;
	readonly value: string;
}

/** Event colour presets (for colour pickers); label them with `labels.toneNames[name]`. */
export const EVENT_CALENDAR_COLORS: readonly EventCalendarColorOption[] = [
	{ name: "brand", value: EVENT_CALENDAR_TONE_COLORS.brand },
	{ name: "blue", value: EVENT_CALENDAR_TONE_COLORS.blue },
	{ name: "green", value: EVENT_CALENDAR_TONE_COLORS.green },
	{ name: "violet", value: EVENT_CALENDAR_TONE_COLORS.violet },
	{ name: "red", value: EVENT_CALENDAR_TONE_COLORS.red },
	{ name: "yellow", value: EVENT_CALENDAR_TONE_COLORS.yellow },
	{ name: "teal", value: EVENT_CALENDAR_TONE_COLORS.teal },
	{ name: "orange", value: EVENT_CALENDAR_TONE_COLORS.orange },
	{ name: "neutral", value: EVENT_CALENDAR_TONE_COLORS.neutral },
];

/** The custom property every tinted surface reads. */
export type EventCalendarToneStyle = React.CSSProperties & Readonly<Record<"--ec-event-color", string>>;

/** One stable style object per tone, so chips never allocate a style per render. */
export const EVENT_CALENDAR_TONE_STYLES: Readonly<Record<EventCalendarTone, EventCalendarToneStyle>> = {
	brand: { "--ec-event-color": EVENT_CALENDAR_TONE_COLORS.brand },
	neutral: { "--ec-event-color": EVENT_CALENDAR_TONE_COLORS.neutral },
	blue: { "--ec-event-color": EVENT_CALENDAR_TONE_COLORS.blue },
	green: { "--ec-event-color": EVENT_CALENDAR_TONE_COLORS.green },
	violet: { "--ec-event-color": EVENT_CALENDAR_TONE_COLORS.violet },
	red: { "--ec-event-color": EVENT_CALENDAR_TONE_COLORS.red },
	yellow: { "--ec-event-color": EVENT_CALENDAR_TONE_COLORS.yellow },
	teal: { "--ec-event-color": EVENT_CALENDAR_TONE_COLORS.teal },
	orange: { "--ec-event-color": EVENT_CALENDAR_TONE_COLORS.orange },
};

/** The tone style of an event (brand when it carries no colour). */
export function getEventToneStyle(tone: EventCalendarTone | undefined): EventCalendarToneStyle {
	return EVENT_CALENDAR_TONE_STYLES[tone ?? "brand"];
}

export interface EventCalendarGhostClasses {
	readonly move: string;
	readonly resize: string;
	readonly invalid: string;
}

/** Drag-ghost surfaces shared by every view: a dashed drop placeholder, destructive when invalid. */
export const EVENT_CALENDAR_GHOST: EventCalendarGhostClasses = {
	move: "rounded-sm border border-dashed border-(--ec-event-color)/60 bg-(--ec-event-color)/10",
	resize: "rounded-sm border border-dashed border-(--ec-event-color)/70 bg-(--ec-event-color)/15",
	invalid: "border-destructive/70 bg-destructive/10",
};

export interface EventCalendarSlotDraftClasses {
	readonly box: string;
	readonly label: string;
}

/** The drag-to-create selection shared by every view. */
export const EVENT_CALENDAR_SLOT_DRAFT: EventCalendarSlotDraftClasses = {
	box: "rounded-sm border border-dashed border-primary/50 bg-primary/10",
	label: "truncate px-1 py-0.5 text-xs leading-none font-medium text-primary",
};

/** Fade-out truncation for squeezed time-grid blocks (exported for custom renderEvent content). */
export const EVENT_CALENDAR_FADE_TRUNCATE = "w-full truncate";

export const eventCalendarEventVariants = cva(
	"group/ec-event relative flex w-full min-w-0 cursor-pointer touch-none items-center overflow-hidden text-start text-foreground outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50",
	{
		variants: {
			variant: {
				chip: "@container gap-1.5 rounded-sm bg-(--ec-event-color)/15 px-1.5 py-0.5 inset-ring inset-ring-(--ec-event-color)/15 transition-colors hover:bg-(--ec-event-color)/25 dark:bg-(--ec-event-color)/25 dark:hover:bg-(--ec-event-color)/35",
				bar: "@container h-full gap-1.5 rounded-sm bg-(--ec-event-color)/15 px-1.5 inset-ring inset-ring-(--ec-event-color)/15 transition-colors hover:bg-(--ec-event-color)/25 dark:bg-(--ec-event-color)/25 dark:hover:bg-(--ec-event-color)/35",
				block:
					"@container h-full flex-col items-start justify-start gap-0 rounded-sm bg-(--ec-event-color)/15 px-1.5 py-1 inset-ring inset-ring-(--ec-event-color)/20 transition-colors hover:bg-(--ec-event-color)/25 dark:bg-(--ec-event-color)/25 dark:hover:bg-(--ec-event-color)/35",
				agenda: "gap-3 rounded-none px-4 py-2.5 text-sm transition-colors hover:bg-muted",
			},
			size: {
				default: "",
				compact: "flex-row items-center gap-1 py-0 leading-4",
			},
			state: {
				default: "",
				selected: "bg-(--ec-event-color)/30 inset-ring-(--ec-event-color)/50 dark:bg-(--ec-event-color)/40",
				dragging: "opacity-40",
				preview: "pointer-events-none",
				disabled: "cursor-default",
			},
		},
		defaultVariants: { variant: "chip", size: "default", state: "default" },
	},
);

export type EventCalendarEventVariant = "chip" | "bar" | "block" | "agenda";
type EventCalendarEventState = "default" | "selected" | "dragging" | "preview" | "disabled";

export interface EventCalendarChipContextValue {
	readonly occurrence: EventCalendarOccurrence;
	readonly segment: EventCalendarSegment;
	readonly isDragging: boolean;
	readonly isSelected: boolean;
}

const EventCalendarChipContext = React.createContext<EventCalendarChipContextValue | null>(null);

/** The chip's subject; usable inside renderEvent content and chip children. */
export function useEventCalendarEventChip(): EventCalendarChipContextValue {
	const context = React.useContext(EventCalendarChipContext);
	if (context === null) {
		throw new Error("useEventCalendarEventChip must be used within <EventCalendarEvent>");
	}
	return context;
}

const TIME_GRID_VIEWS: readonly CalendarView[] = ["week", "day", "days", "resource"];

export interface EventCalendarEventProps extends Omit<React.ComponentPropsWithoutRef<"button">, "children" | "color"> {
	readonly segment: EventCalendarSegment;
	/** Replaces the default chip CONTENT; the wrapper stays calendar-owned. */
	readonly children?: React.ReactNode;
	/** Static drag clone: the chip as-is but inert — no gestures, handles, focus or pointer events. */
	readonly preview?: boolean;
	/** Overrides the surface the view picks (chip / bar / block / agenda). */
	readonly variant?: EventCalendarEventVariant;
}

interface ResizeHandleProps {
	readonly segment: EventCalendarSegment;
	readonly edge: EventCalendarResizeEdge;
	readonly orientation: "vertical" | "horizontal";
	readonly className: string | undefined;
}

const RESIZE_HANDLE_CLASSES: Readonly<Record<ResizeHandleProps["orientation"], Readonly<Record<EventCalendarResizeEdge, string>>>> = {
	vertical: {
		start: "absolute inset-x-1 top-0 h-1.5 cursor-ns-resize",
		end: "absolute inset-x-1 bottom-0 h-1.5 cursor-ns-resize",
	},
	horizontal: {
		start: "absolute inset-y-0 start-0 w-2 cursor-ew-resize",
		end: "absolute inset-y-0 end-0 w-2 cursor-ew-resize",
	},
};

function ResizeHandle({ segment, edge, orientation, className }: ResizeHandleProps): React.JSX.Element {
	const gestures = useEventCalendarGestures();
	const handlePointerDown = React.useCallback(
		(event: React.PointerEvent<HTMLElement>): void => {
			gestures.beginResize(event, segment, edge);
		},
		[gestures, segment, edge],
	);
	return (
		<span
			aria-hidden
			data-slot="event-calendar-resize-handle"
			data-edge={edge}
			className={cn(
				"flex items-center justify-center opacity-0 transition-opacity group-hover/ec-event:opacity-100 motion-reduce:transition-none",
				RESIZE_HANDLE_CLASSES[orientation][edge],
				className,
			)}
			onPointerDown={handlePointerDown}>
			<span className={cn("rounded-full bg-foreground/40", orientation === "vertical" ? "h-0.5 w-2.5" : "h-2.5 w-0.5")} />
		</span>
	);
}

function pickVariant(view: CalendarView, isBar: boolean): EventCalendarEventVariant {
	if (view === "agenda") {
		return "agenda";
	}
	if (TIME_GRID_VIEWS.includes(view) && !isBar) {
		return "block";
	}
	return isBar ? "bar" : "chip";
}

function pickState(preview: boolean, isDragging: boolean, isSelected: boolean): EventCalendarEventState {
	if (preview) {
		return "preview";
	}
	if (isDragging) {
		return "dragging";
	}
	return isSelected ? "selected" : "default";
}

/**
 * The one interactive event element in every view. The wrapper owns a11y, data
 * attributes, selection and drag/resize wiring; content comes from children,
 * else renderEvent / renderAgendaEvent, else the built-in default.
 */
export const EventCalendarEvent = React.forwardRef<HTMLButtonElement, EventCalendarEventProps>(function EventCalendarEvent(
	{ segment, className, children, preview = false, variant: variantProp, style, onPointerDown, onClick, onDoubleClick, onKeyDown, ...props },
	forwardedRef,
): React.JSX.Element {
	const calendar = useEventCalendar();
	const viewConfig = useEventCalendarViewConfig();
	const { view } = useEventCalendarViewContext();
	const gestures = useEventCalendarGestures();
	const draggingKey = useEventCalendarDraggingKey();
	const nowMs = useEventCalendarNow();
	const { settings, state, internals, api } = calendar;
	const { timeZone, locale, i18n, snapDuration } = settings;
	const { occurrence } = segment;
	const { event } = occurrence;

	const isSelected = !preview && state.selection.eventKeys.includes(occurrence.key);
	const isDragging = !preview && draggingKey === occurrence.key;
	const isBar = isBarOccurrence(occurrence, timeZone);
	const inTimeGrid = TIME_GRID_VIEWS.includes(view);
	const interactive = view !== "agenda" && !preview;
	const variant = variantProp ?? pickVariant(view, isBar);
	const minutes = (segment.endMin ?? 0) - (segment.startMin ?? 0);
	const compact = variant === "block" && minutes < viewConfig.compactEventMinutes;
	const granularity: EventCalendarGranularity = inTimeGrid && !isBar ? "minute" : "day";

	const nodeRef = React.useRef<HTMLButtonElement | null>(null);
	const setRef = React.useCallback(
		(node: HTMLButtonElement | null): void => {
			nodeRef.current = node;
			assignRef(forwardedRef, node);
		},
		[forwardedRef],
	);

	// A committed move re-keys the chip (the key encodes the start), so the new
	// chip takes focus back when the keyboard asked for it.
	React.useEffect((): void => {
		if (!preview && internals.consumeFocusRequest(occurrence.eventId)) {
			nodeRef.current?.focus();
		}
	}, [preview, internals, occurrence.eventId]);

	const zonedStart = toZoned(occurrence.start, timeZone);
	const zonedEnd = toZoned(occurrence.end, timeZone);
	const timeLabel = i18n.functions.formatEventTime(zonedStart, zonedEnd, occurrence.allDay, { locale });
	const continues = segment.continuesBefore || segment.continuesAfter;
	const ariaLabel = i18n.functions.formatEventAriaLabel(event.title, timeLabel, continues);
	const tooltip = i18n.functions.formatEventLabel(event.title, timeLabel);

	const agendaTimeText = React.useMemo((): string => {
		if (view !== "agenda") {
			return "";
		}
		if (occurrence.allDay) {
			return i18n.labels.allDay;
		}
		const dayStart = zonedStartOfDay(segment.day, timeZone);
		const dayEnd = addZonedDays(dayStart, 1, timeZone);
		const startsBefore = occurrence.start < dayStart;
		const endsAfter = occurrence.end > dayEnd;
		if (startsBefore && endsAfter) {
			return i18n.labels.allDay;
		}
		if (endsAfter) {
			return i18n.labels.timeFrom(format(toZoned(occurrence.start, timeZone), i18n.formats.eventTime, locale === undefined ? {} : { locale }));
		}
		if (startsBefore) {
			return i18n.labels.timeUntil(format(toZoned(occurrence.end, timeZone), i18n.formats.eventTime, locale === undefined ? {} : { locale }));
		}
		return i18n.functions.formatEventTime(toZoned(occurrence.start, timeZone), toZoned(occurrence.end, timeZone), false, { locale });
	}, [view, occurrence, segment.day, timeZone, i18n, locale]);

	const renderProps = React.useMemo(
		(): EventCalendarRenderEventProps => ({ occurrence, segment, view, isDragging, isSelected }),
		[occurrence, segment, view, isDragging, isSelected],
	);
	const render = view === "agenda" ? viewConfig.renderAgendaEvent : viewConfig.renderEvent;
	const customContent = React.useMemo((): React.ReactNode => render?.(renderProps), [render, renderProps]);

	const showTime = !occurrence.allDay && segment.isStart;
	const startTimeText = format(zonedStart, i18n.formats.eventTime, locale === undefined ? {} : { locale });
	const defaultContent =
		variant === "agenda" ? (
			<>
				<span className="w-40 shrink-0 truncate text-muted-foreground tabular-nums">{agendaTimeText}</span>
				<span aria-hidden data-slot="event-calendar-agenda-dot" className="size-2 shrink-0 rounded-full bg-(--ec-event-color)" />
				<span className="truncate">{event.title}</span>
				{occurrence.isRecurring ? <RepeatIcon aria-hidden className="size-3 shrink-0 text-muted-foreground" /> : null}
			</>
		) : (
			<>
				{variant === "block" ? null : <span aria-hidden data-slot="event-calendar-event-dot" className="size-1.5 shrink-0 rounded-full bg-(--ec-event-color)" />}
				{occurrence.isRecurring ? <RepeatIcon aria-hidden className="size-2.5 shrink-0 opacity-70" /> : null}
				<span className={cn("font-medium", variant === "block" ? EVENT_CALENDAR_FADE_TRUNCATE : "truncate")}>{event.title}</span>
				{showTime && view === "month" ? <span className="shrink-0 text-muted-foreground">{startTimeText}</span> : null}
				{showTime && view !== "month" ? <span className="hidden truncate text-muted-foreground @[8rem]:inline">{timeLabel}</span> : null}
			</>
		);

	const showResize = interactive && gestures.canResize(segment);
	const handleOrientation = variant === "block" ? "vertical" : "horizontal";

	const handlePointerDown = React.useCallback(
		(pointerEvent: React.PointerEvent<HTMLButtonElement>): void => {
			onPointerDown?.(pointerEvent);
			if (pointerEvent.defaultPrevented || preview) {
				return;
			}
			pointerEvent.stopPropagation();
			internals.markChipPress();
			if (interactive) {
				gestures.beginMove(pointerEvent, segment);
			}
		},
		[onPointerDown, preview, internals, interactive, gestures, segment],
	);

	const handleClick = React.useCallback(
		(mouseEvent: React.MouseEvent<HTMLButtonElement>): void => {
			onClick?.(mouseEvent);
			mouseEvent.stopPropagation();
			if (preview || internals.wasRecentGesture()) {
				return;
			}
			internals.clickEvent(occurrence, mouseEvent);
			if (mouseEvent.defaultPrevented || view === "agenda") {
				return;
			}
			api.selectEvent(occurrence.key, { additive: mouseEvent.shiftKey || mouseEvent.metaKey || mouseEvent.ctrlKey });
		},
		[onClick, preview, internals, occurrence, view, api],
	);

	const handleDoubleClick = React.useCallback(
		(mouseEvent: React.MouseEvent<HTMLButtonElement>): void => {
			onDoubleClick?.(mouseEvent);
			mouseEvent.stopPropagation();
			if (!preview) {
				internals.doubleClickEvent(occurrence, mouseEvent);
			}
		},
		[onDoubleClick, preview, internals, occurrence],
	);

	const handleKeyDown = React.useCallback(
		(keyboardEvent: React.KeyboardEvent<HTMLButtonElement>): void => {
			onKeyDown?.(keyboardEvent);
			if (keyboardEvent.defaultPrevented || !interactive) {
				return;
			}
			const intent = resolveKeyboardIntent(keyboardEvent.key, keyboardEvent, granularity, snapDuration);
			if (intent === null) {
				return;
			}
			keyboardEvent.preventDefault();
			keyboardEvent.stopPropagation();
			const allowed = intent.kind === "move" ? gestures.canDrag(segment) : gestures.canResize(segment);
			if (!allowed) {
				internals.dragBlocked(occurrence, { gesture: intent.kind === "move" ? "move" : "resize", reason: event.readOnly === true ? "readOnly" : "disabled" });
				internals.announce(i18n.labels.dropNotAllowed);
				return;
			}
			const range = applyKeyboardIntent(occurrence, intent, granularity, snapDuration, timeZone);
			const update: EventCalendarProposedUpdate = { event, occurrence, start: range.start, end: range.end, allDay: occurrence.allDay, source: "keyboard" };
			if (!internals.canDrop(update)) {
				internals.announce(i18n.labels.dropNotAllowed);
				return;
			}
			if (internals.applyProposedUpdate(update)) {
				internals.requestFocus(occurrence.eventId);
				const movedTime = i18n.functions.formatEventTime(toZoned(range.start, timeZone), toZoned(range.end, timeZone), occurrence.allDay, { locale });
				internals.announce(i18n.labels.eventMoved(event.title, movedTime));
			}
		},
		[onKeyDown, interactive, granularity, snapDuration, gestures, segment, internals, occurrence, event, i18n, timeZone, locale],
	);

	const mergedStyle = React.useMemo(
		(): React.CSSProperties => (style === undefined ? getEventToneStyle(event.color) : { ...getEventToneStyle(event.color), ...style }),
		[style, event.color],
	);
	const chipContext = React.useMemo((): EventCalendarChipContextValue => ({ occurrence, segment, isDragging, isSelected }), [occurrence, segment, isDragging, isSelected]);
	const isPast = occurrence.end.getTime() < nowMs;

	return (
		<EventCalendarChipContext.Provider value={chipContext}>
			<button
				ref={setRef}
				type="button"
				data-slot="event-calendar-event"
				data-view={view}
				data-variant={variant}
				data-all-day={occurrence.allDay ? "" : undefined}
				data-recurring={occurrence.isRecurring ? "" : undefined}
				data-selected={isSelected ? "" : undefined}
				data-dragging={isDragging ? "" : undefined}
				data-preview={preview ? "" : undefined}
				data-past={isPast ? "" : undefined}
				data-event-id={occurrence.eventId}
				title={preview ? undefined : tooltip}
				aria-label={ariaLabel}
				aria-pressed={interactive ? isSelected : undefined}
				aria-hidden={preview ? true : undefined}
				tabIndex={preview ? -1 : undefined}
				style={mergedStyle}
				className={cn(
					eventCalendarEventVariants({ variant, size: compact ? "compact" : "default", state: pickState(preview, isDragging, isSelected) }),
					segment.continuesBefore && variant !== "agenda" ? "rounded-s-none" : undefined,
					segment.continuesAfter && variant !== "agenda" ? "rounded-e-none" : undefined,
					viewConfig.classNames?.event,
					className,
				)}
				onPointerDown={handlePointerDown}
				onClick={handleClick}
				onDoubleClick={handleDoubleClick}
				onKeyDown={handleKeyDown}
				{...props}>
				{children ?? customContent ?? defaultContent}
				{showResize && segment.isStart ? (
					<ResizeHandle segment={segment} edge="start" orientation={handleOrientation} className={viewConfig.classNames?.resizeHandle} />
				) : null}
				{showResize && segment.isEnd ? <ResizeHandle segment={segment} edge="end" orientation={handleOrientation} className={viewConfig.classNames?.resizeHandle} /> : null}
			</button>
		</EventCalendarChipContext.Provider>
	);
});
