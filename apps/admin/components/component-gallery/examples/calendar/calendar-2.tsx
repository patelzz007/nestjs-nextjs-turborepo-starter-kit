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

function initialRange(): DateRange {
	const today = startOfToday();
	return { from: today, to: addDays(today, RANGE_LENGTH_DAYS) };
}

export function Calendar2Example(): React.JSX.Element {
	const [date, setDate] = useState<DateRange | undefined>(initialRange);

	return (
		<Card className="p-0">
			<CardContent className="p-0">
				<Calendar mode="range" onSelect={setDate} selected={date} />
			</CardContent>
		</Card>
	);
}
