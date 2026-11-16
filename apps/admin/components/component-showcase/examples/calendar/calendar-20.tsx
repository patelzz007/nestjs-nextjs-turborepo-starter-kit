"use client";

import { Calendar } from "@workspace/ui/components/calendar";
import { Card, CardContent } from "@workspace/ui/components/card";
import { startOfToday } from "date-fns";
import type * as React from "react";
import { useState } from "react";

/** Two months side by side. */
const MONTHS_SHOWN = 2;

export function Calendar20Example(): React.JSX.Element {
	const [date, setDate] = useState<Date | undefined>(startOfToday);

	return (
		<Card className="p-0">
			<CardContent className="p-0">
				<Calendar mode="single" numberOfMonths={MONTHS_SHOWN} onSelect={setDate} selected={date} />
			</CardContent>
		</Card>
	);
}
