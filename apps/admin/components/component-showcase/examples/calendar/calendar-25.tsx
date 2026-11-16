"use client";

import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { cn } from "@workspace/ui/lib/core/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type * as React from "react";
import { useState } from "react";

/** react-day-picker's range value, read off the kit Calendar's own props. */
type DateRange = NonNullable<Extract<React.ComponentProps<typeof Calendar>, { mode: "range" }>["selected"]>;

/** Two months side by side. */
const MONTHS_SHOWN = 2;
const RANGE_END_FORMAT = "LLL dd, y";

const TRIGGER_BUTTON = <Button className="group/pick-date w-60 justify-between" variant="outline" />;

/** The trigger's text: both ends, the start alone while picking, or a prompt. */
function rangeLabel(range: DateRange | undefined): string {
	if (range?.from === undefined) {
		return "Pick a date range";
	}
	const start = format(range.from, RANGE_END_FORMAT);
	return range.to === undefined ? start : `${start} - ${format(range.to, RANGE_END_FORMAT)}`;
}

export function Calendar25Example(): React.JSX.Element {
	const [date, setDate] = useState<DateRange | undefined>(undefined);

	return (
		<Popover>
			<PopoverTrigger render={TRIGGER_BUTTON}>
				<span className={cn("truncate", date === undefined && "text-muted-foreground")}>{rangeLabel(date)}</span>
				<CalendarIcon aria-hidden="true" className="shrink-0 text-muted-foreground/80 transition-colors group-hover:text-foreground" />
			</PopoverTrigger>
			<PopoverContent align="start" className="w-auto p-0">
				<Card className="p-0">
					<CardContent className="p-0">
						<Calendar mode="range" numberOfMonths={MONTHS_SHOWN} onSelect={setDate} selected={date} />
					</CardContent>
				</Card>
			</PopoverContent>
		</Popover>
	);
}
