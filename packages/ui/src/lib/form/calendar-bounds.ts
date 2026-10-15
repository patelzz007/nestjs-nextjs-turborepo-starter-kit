"use client";

import { parseDateInputString } from "@workspace/ui/lib/form/date-input";
import { startOfDay } from "date-fns";
import * as React from "react";

/** Parses an optional `yyyy-MM-dd` prop; empty/absent/invalid strings yield `undefined`. */
export function parseOptionalDate(value: string | undefined): Date | undefined {
	return value !== undefined && value.length > 0 ? parseDateInputString(value) : undefined;
}

/** The months a calendar's month / year dropdowns reach: `fromDate`'s to `toDate`'s, when set. */
export interface CalendarBoundsProps {
	readonly startMonth?: Date;
	readonly endMonth?: Date;
}

export interface CalendarBounds {
	/** Spread onto the Calendar; empty when neither bound is set, so the Calendar keeps its own default year range. */
	readonly boundsProps: CalendarBoundsProps;
	/** Days before `fromDate` or after `toDate` (the Calendar's `disabled` matcher). */
	readonly isDateDisabled: (date: Date) => boolean;
}

/** What a date picker's optional `fromDate` / `toDate` (`yyyy-MM-dd`) mean for its Calendar. */
export function useCalendarBounds(fromDate: string | undefined, toDate: string | undefined): CalendarBounds {
	const minDate = React.useMemo(() => parseOptionalDate(fromDate), [fromDate]);
	const maxDate = React.useMemo(() => parseOptionalDate(toDate), [toDate]);
	const boundsProps = React.useMemo<CalendarBoundsProps>(
		() => ({ ...(minDate === undefined ? {} : { startMonth: minDate }), ...(maxDate === undefined ? {} : { endMonth: maxDate }) }),
		[minDate, maxDate],
	);
	const isDateDisabled = React.useCallback(
		(date: Date): boolean => {
			const day = startOfDay(date);
			return (minDate !== undefined && day < startOfDay(minDate)) || (maxDate !== undefined && day > startOfDay(maxDate));
		},
		[minDate, maxDate],
	);
	return React.useMemo(() => ({ boundsProps, isDateDisabled }), [boundsProps, isDateDisabled]);
}
