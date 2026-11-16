"use client";

import { Calendar } from "@workspace/ui/components/calendar";
import { Card, CardContent } from "@workspace/ui/components/card";
import { startOfToday } from "date-fns";
import type * as React from "react";
import { useState } from "react";

/** The earliest month the year dropdown reaches: July 1980 (`Date` months are 0-based). */
const JULY = 6;
const START_MONTH = new Date(1980, JULY);

// The month stays a label and only the year is a dropdown (the kit Calendar
// renders it as the UI kit's Select); the arrows still step a month at a time.
export function Calendar9Example(): React.JSX.Element {
	const [date, setDate] = useState<Date | undefined>(startOfToday);

	return (
		<Card className="p-0">
			<CardContent className="p-0">
				<Calendar captionLayout="dropdown-years" mode="single" onSelect={setDate} selected={date} startMonth={START_MONTH} />
			</CardContent>
		</Card>
	);
}
