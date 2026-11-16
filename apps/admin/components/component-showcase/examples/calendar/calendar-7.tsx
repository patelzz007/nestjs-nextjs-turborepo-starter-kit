"use client";

import { Calendar } from "@workspace/ui/components/calendar";
import { Card, CardContent } from "@workspace/ui/components/card";
import { startOfToday } from "date-fns";
import type * as React from "react";
import { useState } from "react";

/** The caption on the left, both arrows grouped on the right. */
const RIGHT_NAVIGATION_CLASS_NAMES: NonNullable<React.ComponentProps<typeof Calendar>["classNames"]> = {
	month_caption: "ms-2.5 justify-start",
	nav: "pointer-events-none flex items-center w-full absolute top-0 inset-x-0 justify-end [&>button]:pointer-events-auto",
};

export function Calendar7Example(): React.JSX.Element {
	const [date, setDate] = useState<Date | undefined>(startOfToday);

	return (
		<Card className="p-0">
			<CardContent className="p-0">
				<Calendar classNames={RIGHT_NAVIGATION_CLASS_NAMES} mode="single" onSelect={setDate} selected={date} />
			</CardContent>
		</Card>
	);
}
