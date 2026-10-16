"use client";

import { Calendar } from "@workspace/ui/components/calendar";
import { Card, CardContent } from "@workspace/ui/components/card";
import { addDays, startOfToday } from "date-fns";
import type * as React from "react";
import { useMemo } from "react";

/** react-day-picker's `disabled` matchers, read off the kit Calendar's own props. */
type DisabledMatchers = React.ComponentProps<typeof Calendar>["disabled"];

/** `Date#getDay` values of the weekend. */
const SUNDAY = 0;
const SATURDAY = 6;
const WEEKEND_DAYS: readonly number[] = [SUNDAY, SATURDAY];

/** Two sample blocked stretches, as day offsets from today. */
const FIRST_BLOCK_START_DAYS = 14;
const FIRST_BLOCK_END_DAYS = 16;
const SECOND_BLOCK_START_DAYS = 23;
const SECOND_BLOCK_END_DAYS = 24;

export function Calendar3Example(): React.JSX.Element {
	const disabled = useMemo((): DisabledMatchers => {
		const today = startOfToday();
		return [
			{ before: today },
			today,
			{ dayOfWeek: [...WEEKEND_DAYS] },
			{ from: addDays(today, FIRST_BLOCK_START_DAYS), to: addDays(today, FIRST_BLOCK_END_DAYS) },
			{ from: addDays(today, SECOND_BLOCK_START_DAYS), to: addDays(today, SECOND_BLOCK_END_DAYS) },
		];
	}, []);

	return (
		<Card className="p-0">
			<CardContent className="p-0">
				<Calendar disabled={disabled} excludeDisabled mode="range" />
			</CardContent>
		</Card>
	);
}
