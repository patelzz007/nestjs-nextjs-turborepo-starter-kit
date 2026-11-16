"use client";

import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Card, CardContent } from "@workspace/ui/components/card";
import { addDays, startOfToday } from "date-fns";
import type * as React from "react";
import { useCallback, useState } from "react";

/** The sample selection sits four weeks back, so the calendar opens on an earlier month. */
const SELECTED_DAY_OFFSET = -28;

function initialSelection(): Date {
	return addDays(startOfToday(), SELECTED_DAY_OFFSET);
}

export function Calendar11Example(): React.JSX.Element {
	const [month, setMonth] = useState<Date>(initialSelection);
	const [date, setDate] = useState<Date | undefined>(initialSelection);

	const showCurrentMonth = useCallback((): void => {
		setMonth(startOfToday());
	}, []);

	return (
		<Card className="p-0">
			<CardContent className="p-0">
				<Calendar mode="single" month={month} onMonthChange={setMonth} onSelect={setDate} selected={date} />
				<Button className="mb-2 ml-4" onClick={showCurrentMonth} size="sm" variant="outline">
					Current month
				</Button>
			</CardContent>
		</Card>
	);
}
