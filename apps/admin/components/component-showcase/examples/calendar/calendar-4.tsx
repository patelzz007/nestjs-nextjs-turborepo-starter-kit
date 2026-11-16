"use client";

import { Calendar } from "@workspace/ui/components/calendar";
import { Card, CardContent } from "@workspace/ui/components/card";
import { addDays, startOfToday } from "date-fns";
import type * as React from "react";
import { useState } from "react";

/** The sample selection: days relative to today (negative = in the past). */
const SELECTED_DAY_OFFSETS: readonly number[] = [-17, 2, 6, 8];

function initialDays(): Date[] {
	const today = startOfToday();
	return SELECTED_DAY_OFFSETS.map((offset: number): Date => addDays(today, offset));
}

export function Calendar4Example(): React.JSX.Element {
	const [date, setDate] = useState<Date[] | undefined>(initialDays);

	return (
		<Card className="p-0">
			<CardContent className="p-0">
				<Calendar mode="multiple" onSelect={setDate} selected={date} />
			</CardContent>
		</Card>
	);
}
