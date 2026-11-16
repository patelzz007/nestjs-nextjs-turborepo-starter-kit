"use client";

import { addMonths } from "date-fns";
import * as React from "react";
import { Label } from "@workspace/ui/components/label";
import { MultiDatePicker } from "@workspace/ui/components/multi-date-picker";
import { useSampleNow } from "@/components/component-showcase/examples/sample-clock";
import { formatDateInputString } from "@workspace/ui/lib/form/date-input";

/** How far ahead days can be picked. */
const BOOKING_WINDOW_MONTHS = 3;
/** The most days one pick accepts. */
const MAX_PICKED_DAYS = 5;
const NO_DAYS: readonly string[] = [];

export function MultiDatePicker1Example(): React.JSX.Element {
	const [days, setDays] = React.useState<readonly string[]>(NO_DAYS);
	// One stable "now": the bounds only need to be right for this visit.
	const today = new Date(useSampleNow());

	return (
		<div className="flex w-full max-w-sm flex-col gap-1.5">
			<Label htmlFor="usage-multi-date-picker">Available days</Label>
			<MultiDatePicker
				id="usage-multi-date-picker"
				value={days}
				onValueChange={setDays}
				placeholder="Pick up to 5 days"
				fromDate={formatDateInputString(today)}
				toDate={formatDateInputString(addMonths(today, BOOKING_WINDOW_MONTHS))}
				maxDates={MAX_PICKED_DAYS}
			/>
		</div>
	);
}
