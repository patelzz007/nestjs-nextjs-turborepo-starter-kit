"use client";

// Ported from ReUI (https://reui.io/r/base-vega/event-calendar-agenda-view.json):
// the chronological agenda grouped by day — a day header row plus a time / dot
// / title list. The component name matches ReUI. Deviations: ArrowUp/ArrowDown
// (and Home/End) move focus between the agenda rows; `renderAgendaEventDetails`
// adds a disclosure toggle under a row (ReUI's details toggle); the empty state
// uses the kit's `IconStack`; native scrollbars are not ported.
import { IconStack } from "@workspace/ui/components/icon-stack";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { assignRef } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { format } from "date-fns";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";
import * as React from "react";

import { EventCalendarViewContext, useEventCalendar, useEventCalendarNow, useEventCalendarViewConfig, type EventCalendarViewContextValue } from "./event-calendar";
import { EventCalendarEvent } from "./event-calendar-event";
import { getDayKey, getVisibleDays, toZoned } from "./event-calendar-lib";
import type { EventCalendarSegment } from "./event-calendar-types";

const AGENDA_VIEW_CONTEXT: EventCalendarViewContextValue = { view: "agenda" };
const AGENDA_ROW_SELECTOR = "[data-slot=event-calendar-event]";

export type EventCalendarAgendaViewProps = React.ComponentPropsWithoutRef<"div">;

interface AgendaDay {
	readonly day: Date;
	readonly segments: readonly EventCalendarSegment[];
}

/** ArrowUp/ArrowDown/Home/End move focus between the agenda rows. */
function moveAgendaFocus(root: HTMLElement, event: KeyboardEvent): void {
	const { target } = event;
	if (event.defaultPrevented || event.altKey || !(target instanceof HTMLElement) || !target.matches(AGENDA_ROW_SELECTOR)) {
		return;
	}
	const rows = [...root.querySelectorAll<HTMLElement>(AGENDA_ROW_SELECTOR)];
	const current = rows.indexOf(target);
	const targets: Readonly<Record<string, number>> = { ArrowDown: current + 1, ArrowUp: current - 1, Home: 0, End: rows.length - 1 };
	const next = targets[event.key];
	if (next === undefined) {
		return;
	}
	event.preventDefault();
	rows.at(Math.min(Math.max(next, 0), rows.length - 1))?.focus();
}

function AgendaItem({ segment }: { readonly segment: EventCalendarSegment }): React.JSX.Element {
	const { settings } = useEventCalendar();
	const viewConfig = useEventCalendarViewConfig();
	const [expanded, setExpanded] = React.useState(false);
	const detailsId = React.useId();
	const details = viewConfig.renderAgendaEventDetails?.(segment.occurrence);
	const toggle = React.useCallback((): void => {
		setExpanded((previous: boolean): boolean => !previous);
	}, [setExpanded]);
	const hasDetails = details !== undefined && details !== null && details !== false;
	return (
		<div data-slot="event-calendar-agenda-item" className={cn("border-b border-border", viewConfig.classNames?.agendaItem)}>
			<div className="flex items-center">
				<EventCalendarEvent segment={segment} />
				{hasDetails ? (
					<button
						type="button"
						aria-expanded={expanded}
						aria-controls={detailsId}
						aria-label={settings.i18n.labels.eventDetails(segment.occurrence.event.title)}
						className="me-2 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
						onClick={toggle}>
						<ChevronDownIcon aria-hidden className={cn("size-4 transition-transform motion-reduce:transition-none", expanded ? "rotate-180" : undefined)} />
					</button>
				) : null}
			</div>
			{hasDetails && expanded ? (
				<div id={detailsId} className="px-4 ps-48 pb-3">
					{details}
				</div>
			) : null}
		</div>
	);
}

/** Chronological agenda grouped by day. */
export const EventCalendarAgendaView = React.forwardRef<HTMLDivElement, EventCalendarAgendaViewProps>(function EventCalendarAgendaView(
	{ className, ...props },
	forwardedRef,
): React.JSX.Element {
	const { settings, state, index } = useEventCalendar();
	const viewConfig = useEventCalendarViewConfig();
	const nowMs = useEventCalendarNow();
	const { timeZone, locale, i18n } = settings;
	const { visibleRange } = state;
	const options = locale === undefined ? {} : { locale };
	const todayKey = getDayKey(new Date(nowMs), timeZone);

	const groups = React.useMemo(
		(): readonly AgendaDay[] =>
			getVisibleDays(visibleRange, timeZone)
				.map((day: Date): AgendaDay => {
					const bucket = index.byDay.get(getDayKey(day, timeZone));
					return { day, segments: bucket === undefined ? [] : [...bucket.allDay, ...bucket.timed] };
				})
				.filter((group: AgendaDay): boolean => group.segments.length > 0),
		[visibleRange, timeZone, index],
	);

	// Row navigation lives on a native listener: the agenda root is a labelled group, not a widget.
	const rootRef = React.useRef<HTMLDivElement | null>(null);
	const setRefs = React.useCallback(
		(node: HTMLDivElement | null): void => {
			rootRef.current = node;
			assignRef(forwardedRef, node);
		},
		[forwardedRef],
	);
	React.useEffect((): (() => void) | undefined => {
		const root = rootRef.current;
		if (root === null) {
			return undefined;
		}
		const listener = (event: KeyboardEvent): void => {
			moveAgendaFocus(root, event);
		};
		root.addEventListener("keydown", listener);
		return (): void => {
			root.removeEventListener("keydown", listener);
		};
	}, []);

	const body =
		groups.length === 0 ? (
			<div data-slot="event-calendar-no-events" className={cn("flex min-h-72 flex-col items-center justify-center gap-4 py-16", viewConfig.classNames?.noEvents)}>
				{viewConfig.renderNoEvents?.() ?? (
					<>
						<IconStack>
							<CalendarIcon aria-hidden className="size-5" />
						</IconStack>
						<span className="text-sm text-muted-foreground">{i18n.labels.noEvents}</span>
					</>
				)}
			</div>
		) : (
			<div className="flex flex-col">
				{groups.map((group: AgendaDay): React.JSX.Element => {
					const zoned = toZoned(group.day, timeZone);
					const weekday = format(zoned, i18n.formats.agendaWeekday, options);
					const date = format(zoned, i18n.formats.agendaDate, options);
					const isToday = getDayKey(group.day, timeZone) === todayKey;
					return (
						<div
							key={group.day.getTime()}
							role="group"
							aria-label={`${weekday}, ${date}, ${i18n.labels.events(group.segments.length)}`}
							data-slot="event-calendar-agenda-day"
							data-today={isToday ? "" : undefined}
							className={viewConfig.classNames?.agendaDay}>
							<div
								role="heading"
								aria-level={3}
								data-slot="event-calendar-agenda-day-header"
								className={cn(
									"sticky top-0 z-sticky flex items-baseline justify-between gap-4 border-b border-border bg-muted px-4 py-2",
									viewConfig.classNames?.agendaDayHeader,
								)}>
								<span className={cn("font-semibold", isToday ? "text-primary" : "text-foreground")}>{weekday}</span>
								<span className="font-medium text-muted-foreground tabular-nums">{date}</span>
							</div>
							{group.segments.map((segment: EventCalendarSegment): React.JSX.Element => (
								<AgendaItem key={segment.occurrence.key} segment={segment} />
							))}
						</div>
					);
				})}
			</div>
		);

	return (
		<EventCalendarViewContext.Provider value={AGENDA_VIEW_CONTEXT}>
			<div
				ref={setRefs}
				role="group"
				aria-label={i18n.functions.formatDayRange({ start: toZoned(visibleRange.start, timeZone), end: toZoned(visibleRange.end, timeZone) }, { locale })}
				data-slot="event-calendar-agenda-view"
				data-view="agenda"
				className={cn("flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border", viewConfig.classNames?.agendaView, className)}
				{...props}>
				<ScrollArea className="h-full">{body}</ScrollArea>
			</div>
		</EventCalendarViewContext.Provider>
	);
});
