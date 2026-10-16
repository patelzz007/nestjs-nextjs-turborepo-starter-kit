"use client";

// Ported from ReUI (https://reui.io/r/base-vega/event-calendar-content.json): the
// active-view switchboard. `EventCalendarContent`, its `components` /
// `children` props and `DEFAULT_VIEW_COMPONENTS` match ReUI; the loading state
// is a CVA `state` axis and `render` (Base UI useRender) is not ported.
import { cn } from "@workspace/ui/lib/core/utils";
import { cva } from "class-variance-authority";
import * as React from "react";

import { useEventCalendar, useEventCalendarViewConfig } from "./event-calendar";
import { EventCalendarAgendaView } from "./event-calendar-agenda-view";
import { EventCalendarMonthView } from "./event-calendar-month-view";
import { EventCalendarResourceView } from "./event-calendar-resource-view";
import { EventCalendarDaysView, EventCalendarDayView, EventCalendarWeekView } from "./event-calendar-time-grid";
import type { CalendarView } from "./event-calendar-types";

export const DEFAULT_VIEW_COMPONENTS: Readonly<Record<CalendarView, React.ComponentType>> = {
	month: EventCalendarMonthView,
	week: EventCalendarWeekView,
	day: EventCalendarDayView,
	days: EventCalendarDaysView,
	agenda: EventCalendarAgendaView,
	resource: EventCalendarResourceView,
};

export const eventCalendarContentVariants = cva("relative flex min-h-0 min-w-0 flex-1 flex-col", {
	variants: {
		variant: { default: "" },
		size: { default: "" },
		state: { default: "", loading: "pointer-events-none opacity-60 motion-safe:transition-opacity" },
	},
	defaultVariants: { variant: "default", size: "default", state: "default" },
});

export interface EventCalendarContentProps extends Omit<React.ComponentPropsWithoutRef<"div">, "children"> {
	/** Swap individual view implementations. */
	readonly components?: Partial<Record<CalendarView, React.ComponentType>>;
	/** Replaces the switchboard entirely; read useEventCalendarView() inside. */
	readonly children?: React.ReactNode;
}

/** Renders the active view (month, week, day, N-days, agenda or resource). */
export const EventCalendarContent = React.forwardRef<HTMLDivElement, EventCalendarContentProps>(function EventCalendarContent(
	{ className, components, children, ...props },
	forwardedRef,
): React.JSX.Element {
	const { state, settings } = useEventCalendar();
	const viewConfig = useEventCalendarViewConfig();
	const { view, loading } = state;
	// A spread copies keys holding `undefined`, so fall back per view.
	const ActiveView = components?.[view] ?? viewConfig.components?.[view] ?? DEFAULT_VIEW_COMPONENTS[view];
	return (
		<div
			ref={forwardedRef}
			data-slot="event-calendar-content"
			data-view={view}
			data-loading={loading ? "" : undefined}
			aria-busy={loading}
			className={cn(eventCalendarContentVariants({ state: loading ? "loading" : "default" }), viewConfig.classNames?.content, className)}
			{...props}>
			{children ?? <ActiveView />}
			{loading ? <span className="sr-only">{settings.i18n.labels.loading}</span> : null}
		</div>
	);
});
