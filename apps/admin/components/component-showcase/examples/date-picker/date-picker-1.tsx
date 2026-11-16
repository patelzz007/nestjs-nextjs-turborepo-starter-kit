"use client";

import { addMonths } from "date-fns";
import * as React from "react";
import { DatePicker } from "@workspace/ui/components/date-picker";
import { Label } from "@workspace/ui/components/label";
import { useSampleNow } from "@/components/component-showcase/examples/sample-clock";
import { formatDateInputString } from "@workspace/ui/lib/form/date-input";

/** How far ahead a delivery can be booked. */
const BOOKING_WINDOW_MONTHS = 3;

export function DatePicker1Example(): React.JSX.Element {
	const [date, setDate] = React.useState<string>("");
	// One stable "now": the bounds only need to be right for this visit.
	const today = new Date(useSampleNow());

	return (
		<div className="flex w-full max-w-xs flex-col gap-1.5">
			<Label htmlFor="usage-date-picker">Delivery date</Label>
			<DatePicker
				id="usage-date-picker"
				value={date}
				onValueChange={setDate}
				placeholder="Pick a date"
				fromDate={formatDateInputString(today)}
				toDate={formatDateInputString(addMonths(today, BOOKING_WINDOW_MONTHS))}
			/>
		</div>
	);
}
