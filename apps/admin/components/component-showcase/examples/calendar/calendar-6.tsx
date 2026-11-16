"use client";

import { Calendar } from "@workspace/ui/components/calendar";
import { Card, CardContent } from "@workspace/ui/components/card";
import { addDays, startOfToday } from "date-fns";
import type * as React from "react";
import { useState } from "react";

/** react-day-picker's range value, read off the kit Calendar's own props. */
type DateRange = NonNullable<Extract<React.ComponentProps<typeof Calendar>, { mode: "range" }>["selected"]>;

/** How many days after today the initial range ends. */
const RANGE_LENGTH_DAYS = 5;

/** Round range ends joined by a band behind the middle days. */
const CIRCULAR_RANGE_CLASS_NAMES: NonNullable<React.ComponentProps<typeof Calendar>["classNames"]> = {
	day: "relative before:absolute before:inset-y-px before:inset-x-0 [&.range-start:not(.range-end):before]:bg-linear-to-r before:from-transparent before:from-50% before:to-accent before:to-50% [&.range-end:not(.range-start):before]:bg-linear-to-l",
	day_button: "rounded-full! group-[.range-start:not(.range-end)]:rounded-e-full group-[.range-end:not(.range-start)]:rounded-s-full",
};

function initialRange(): DateRange {
	const today = startOfToday();
	return { from: today, to: addDays(today, RANGE_LENGTH_DAYS) };
}

export function Calendar6Example(): React.JSX.Element {
	const [date, setDate] = useState<DateRange | undefined>(initialRange);

	return (
		<Card className="p-0">
			<CardContent className="p-0">
				<Calendar classNames={CIRCULAR_RANGE_CLASS_NAMES} mode="range" onSelect={setDate} selected={date} />
			</CardContent>
		</Card>
	);
}
