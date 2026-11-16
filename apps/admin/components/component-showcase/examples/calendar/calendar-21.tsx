"use client";

import { Calendar } from "@workspace/ui/components/calendar";
import { Card, CardContent } from "@workspace/ui/components/card";
import { endOfMonth, setDate, startOfToday } from "date-fns";
import type * as React from "react";
import { useState } from "react";

/** react-day-picker's range value, read off the kit Calendar's own props. */
type DateRange = NonNullable<Extract<React.ComponentProps<typeof Calendar>, { mode: "range" }>["selected"]>;

/** The sample range: the 6th to the 18th of this month. */
const RANGE_START_DAY = 6;
const RANGE_END_DAY = 18;
/** Two months side by side. */
const MONTHS_SHOWN = 2;

function initialRange(): DateRange {
	const today = startOfToday();
	const lastDay = endOfMonth(today).getDate();
	return { from: setDate(today, Math.min(RANGE_START_DAY, lastDay)), to: setDate(today, Math.min(RANGE_END_DAY, lastDay)) };
}

export function Calendar21Example(): React.JSX.Element {
	const [date, setDateRange] = useState<DateRange | undefined>(initialRange);

	return (
		<Card className="p-0">
			<CardContent className="p-0">
				<Calendar mode="range" numberOfMonths={MONTHS_SHOWN} onSelect={setDateRange} selected={date} />
			</CardContent>
		</Card>
	);
}
