"use client";

import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { cn } from "@workspace/ui/lib/core/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type * as React from "react";
import { useState } from "react";

const TRIGGER_BUTTON = <Button className="group/pick-date w-60 justify-between" variant="outline" />;

export function Calendar24Example(): React.JSX.Element {
	const [date, setDate] = useState<Date | undefined>(undefined);

	return (
		<Popover>
			<PopoverTrigger render={TRIGGER_BUTTON}>
				<span className={cn("truncate", date === undefined && "text-muted-foreground")}>{date === undefined ? "Pick a date" : format(date, "PPP")}</span>
				<CalendarIcon aria-hidden="true" className="opacity-60 transition-opacity group-hover/pick-date:opacity-100" />
			</PopoverTrigger>
			<PopoverContent align="start" className="w-auto p-0">
				<Calendar mode="single" onSelect={setDate} selected={date} />
			</PopoverContent>
		</Popover>
	);
}
