"use client";

// Ported from ReUI (https://reui.io/r/base-vega/event-calendar-resource-view.json):
// one day of the anchor date with a booking column per leaf resource. The
// component name and props (`dayStartHour`, `dayEndHour`, `showAllDay`,
// `interval`) match ReUI. Deviations: it reuses the time grid's day column,
// all-day cell, gutter, now line and keyboard model (roving focus between
// resource columns, a slot cursor, Enter/Space to create) instead of keeping a
// second copy; dragging across columns proposes `resourceId`.
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

import {
	EventCalendarViewContext,
	useEventCalendar,
	useEventCalendarDay,
	useEventCalendarViewConfig,
	useEventCalendarViewSettings,
	type EventCalendarViewContextValue,
} from "./event-calendar";
import { leafResources, MINUTES_PER_HOUR, packTimedSegments, zonedStartOfDay } from "./event-calendar-lib";
import {
	EventCalendarAllDayCell,
	EventCalendarDayColumn,
	EventCalendarNowIndicator,
	EventCalendarTimeGutter,
	timeGridColumnKey,
	useTimeGridKeyboard,
	useTimeSlots,
	type TimeGridColumn,
} from "./event-calendar-time-grid";
import type { EventCalendarResource, EventCalendarSegment } from "./event-calendar-types";

const RESOURCE_VIEW_CONTEXT: EventCalendarViewContextValue = { view: "resource" };
const MIN_INTERVAL_MINUTES = 5;
const MAX_INTERVAL_MINUTES = 240;
const TRACK_STYLE: React.CSSProperties & Readonly<Record<"--ec-hour-height", string>> = { "--ec-hour-height": "3rem" };

export interface EventCalendarResourceViewProps extends React.ComponentPropsWithoutRef<"div"> {
	readonly dayStartHour?: number;
	readonly dayEndHour?: number;
	readonly showAllDay?: boolean;
	/** Gutter/gridline interval in minutes; defaults to the interval view config. */
	readonly interval?: number;
}

function belongsTo(segment: EventCalendarSegment, resourceId: string): boolean {
	return segment.occurrence.event.resourceId === resourceId;
}

const ResourceHeader = React.memo(function ResourceHeader({ resource }: { readonly resource: EventCalendarResource }): React.JSX.Element {
	const viewConfig = useEventCalendarViewConfig();
	return (
		<div
			role="columnheader"
			data-slot="event-calendar-resource-header"
			className={cn("min-w-0 truncate border-e border-border px-2 py-1.5 text-center font-medium last:border-e-0", viewConfig.classNames?.resourceHeader)}>
			{viewConfig.renderResourceHeader?.({ resource }) ?? resource.title}
		</div>
	);
});

/** Leaf resources become booking columns for the anchor day. */
export const EventCalendarResourceView = React.forwardRef<HTMLDivElement, EventCalendarResourceViewProps>(function EventCalendarResourceView(
	{ dayStartHour, dayEndHour, showAllDay = true, interval: intervalProp, className, onKeyDown, style, ...props },
	forwardedRef,
): React.JSX.Element {
	const { settings, state } = useEventCalendar();
	const viewConfig = useEventCalendarViewConfig();
	const { effective } = useEventCalendarViewSettings();
	const { timeZone, i18n } = settings;
	const startHour = dayStartHour ?? settings.dayStartHour;
	const endHour = dayEndHour ?? settings.dayEndHour;
	const interval = Math.min(Math.max(intervalProp ?? viewConfig.interval, MIN_INTERVAL_MINUTES), MAX_INTERVAL_MINUTES);
	const dateMs = state.date.getTime();
	const day = React.useMemo((): Date => zonedStartOfDay(new Date(dateMs), timeZone), [dateMs, timeZone]);
	const { segments } = useEventCalendarDay(day);
	const resources = React.useMemo((): readonly EventCalendarResource[] => leafResources(settings.resources), [settings.resources]);
	const columns = React.useMemo(
		(): readonly TimeGridColumn[] =>
			resources.map((resource: EventCalendarResource): TimeGridColumn => ({ key: timeGridColumnKey(day, timeZone, resource.id), day, resourceId: resource.id })),
		[resources, day, timeZone],
	);
	const timedByResource = React.useMemo(
		(): ReadonlyMap<string, readonly EventCalendarSegment[]> =>
			new Map(
				resources.map((resource: EventCalendarResource): [string, readonly EventCalendarSegment[]] => [
					resource.id,
					packTimedSegments(segments.timed.filter((segment: EventCalendarSegment): boolean => belongsTo(segment, resource.id))),
				]),
			),
		[resources, segments.timed],
	);
	const allDayByResource = React.useMemo(
		(): ReadonlyMap<string, readonly EventCalendarSegment[]> =>
			new Map(
				resources.map((resource: EventCalendarResource): [string, readonly EventCalendarSegment[]] => [
					resource.id,
					segments.allDay.filter((segment: EventCalendarSegment): boolean => belongsTo(segment, resource.id)),
				]),
			),
		[resources, segments.allDay],
	);
	const slots = useTimeSlots(startHour, endHour, interval);
	const bounds = React.useMemo(() => ({ startMin: startHour * MINUTES_PER_HOUR, endMin: endHour * MINUTES_PER_HOUR }), [startHour, endHour]);
	const keyboard = useTimeGridKeyboard(columns, bounds, "resource");
	const days = React.useMemo((): readonly Date[] => columns.map((column: TimeGridColumn): Date => column.day), [columns]);
	const columnsStyle = React.useMemo(
		(): React.CSSProperties => ({ gridTemplateColumns: `repeat(${String(Math.max(1, resources.length))}, minmax(var(--ec-resource-col-min, 8rem), 1fr))` }),
		[resources.length],
	);
	const rootStyle = React.useMemo((): React.CSSProperties => ({ ...TRACK_STYLE, ...style }), [style]);
	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>): void => {
			onKeyDown?.(event);
			if (!event.defaultPrevented) {
				keyboard.onKeyDown(event);
			}
		},
		[onKeyDown, keyboard],
	);

	return (
		<EventCalendarViewContext.Provider value={RESOURCE_VIEW_CONTEXT}>
			<div
				ref={forwardedRef}
				role="grid"
				tabIndex={-1}
				aria-label={i18n.labels.resources}
				aria-readonly
				data-slot="event-calendar-resource-view"
				data-view="resource"
				className={cn("flex min-h-0 flex-1 flex-col overflow-x-auto border-t border-border", viewConfig.classNames?.timeGrid, className)}
				style={rootStyle}
				onKeyDown={handleKeyDown}
				{...props}>
				<div role="row" className={cn("flex border-b border-border", viewConfig.classNames?.timeGridHeader)}>
					<div aria-hidden className="w-(--ec-gutter-width,4.5rem) shrink-0 border-e border-border" />
					<div className="grid min-w-0 flex-1" style={columnsStyle}>
						{resources.map((resource: EventCalendarResource): React.JSX.Element => (
							<ResourceHeader key={resource.id} resource={resource} />
						))}
					</div>
				</div>
				{showAllDay ? (
					<div role="row" data-slot="event-calendar-all-day-section" className={cn("flex border-b border-border", viewConfig.classNames?.allDaySection)}>
						<div
							className={cn(
								"flex w-(--ec-gutter-width,4.5rem) shrink-0 justify-end border-e border-border px-2 pt-1.5 text-muted-foreground",
								viewConfig.classNames?.allDayLabel,
							)}>
							{i18n.labels.allDay}
						</div>
						<div className="grid min-w-0 flex-1" style={columnsStyle}>
							{resources.map((resource: EventCalendarResource): React.JSX.Element => (
								<EventCalendarAllDayCell key={resource.id} day={day} resourceId={resource.id} segments={allDayByResource.get(resource.id) ?? []} />
							))}
						</div>
					</div>
				) : null}
				<div className="min-h-0 flex-1">
					<ScrollArea className="h-full">
						<div role="row" className="relative flex">
							<EventCalendarTimeGutter days={days} slots={slots} startHour={startHour} interval={interval} />
							<div className="grid min-w-0 flex-1" style={columnsStyle}>
								{columns.map((column: TimeGridColumn): React.JSX.Element => (
									<EventCalendarDayColumn
										key={column.key}
										day={day}
										columnKey={column.key}
										{...(column.resourceId === undefined ? {} : { resourceId: column.resourceId })}
										segments={timedByResource.get(column.resourceId ?? "") ?? []}
										startHour={startHour}
										endHour={endHour}
										interval={interval}
										tabbable={column.key === keyboard.focusedKey}
										cursorMin={keyboard.cursorMin}
										onColumnFocus={keyboard.onColumnFocus}
									/>
								))}
							</div>
							{effective.nowIndicator ? <EventCalendarNowIndicator days={days} startHour={startHour} endHour={endHour} /> : null}
						</div>
					</ScrollArea>
				</div>
			</div>
		</EventCalendarViewContext.Provider>
	);
});
