"use client";

import { Calendar } from "@workspace/ui/components/calendar";
import { Card, CardContent } from "@workspace/ui/components/card";
import { startOfToday } from "date-fns";
import type * as React from "react";
import { useState } from "react";

/** The earliest month the dropdowns offer: July 1980 (`Date` months are 0-based). */
const JULY = 6;
const START_MONTH = new Date(1980, JULY);

/** No arrows, so the caption needs no room for them. */
const SELECT_CAPTION_CLASS_NAMES: NonNullable<React.ComponentProps<typeof Calendar>["classNames"]> = {
	month_caption: "px-0",
};

// The kit Calendar's default caption already renders the month and the year as
// the UI kit's Select, so the example needs no custom dropdown components.
export function Calendar8Example(): React.JSX.Element {
	const [date, setDate] = useState<Date | undefined>(startOfToday);

	return (
		<Card className="p-0">
			<CardContent className="p-0">
				<Calendar captionLayout="dropdown" classNames={SELECT_CAPTION_CLASS_NAMES} hideNavigation mode="single" onSelect={setDate} selected={date} startMonth={START_MONTH} />
			</CardContent>
		</Card>
	);
}
