"use client";

import { Calendar } from "@workspace/ui/components/calendar";
import { Card, CardContent } from "@workspace/ui/components/card";
import { startOfToday } from "date-fns";
import type * as React from "react";
import { useState } from "react";

/** Round day buttons instead of the default rounded squares. */
const CIRCULAR_DAY_CLASS_NAMES: NonNullable<React.ComponentProps<typeof Calendar>["classNames"]> = {
	day_button: "rounded-full!",
};

export function Calendar5Example(): React.JSX.Element {
	const [date, setDate] = useState<Date | undefined>(startOfToday);

	return (
		<Card className="p-0">
			<CardContent className="p-0">
				<Calendar classNames={CIRCULAR_DAY_CLASS_NAMES} mode="single" onSelect={setDate} selected={date} />
			</CardContent>
		</Card>
	);
}
