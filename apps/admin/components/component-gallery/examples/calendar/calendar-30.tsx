"use client";

import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { Separator } from "@workspace/ui/components/separator";
import { cn } from "@workspace/ui/lib/core/utils";
import { format, setDate, startOfToday } from "date-fns";
import { CalendarIcon, ClockIcon } from "lucide-react";
import type * as React from "react";
import { useId, useState } from "react";

/** The sample selection: the 12th of this month, 10:30:00 to 12:30:00. */
const SAMPLE_DAY = 12;
const DEFAULT_START_TIME = "10:30:00";
const DEFAULT_END_TIME = "12:30:00";
/** The time inputs step by whole seconds. */
const TIME_STEP_SECONDS = "1";
const TIME_INPUT_CLASS_NAME = "appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none";

const TRIGGER_BUTTON = <Button className="group/pick-date w-60 justify-between" variant="outline" />;

function initialSelection(): Date {
	return setDate(startOfToday(), SAMPLE_DAY);
}

export function Calendar30Example(): React.JSX.Element {
	const id = useId();
	const startTimeId = `${id}-start-time`;
	const endTimeId = `${id}-end-time`;
	const [date, setSelectedDate] = useState<Date | undefined>(initialSelection);

	return (
		<Popover>
			<PopoverTrigger render={TRIGGER_BUTTON}>
				<span className={cn("truncate", date === undefined && "text-muted-foreground")}>{date === undefined ? "Pick a date and time" : format(date, "PPP")}</span>
				<CalendarIcon aria-hidden="true" className="shrink-0 text-muted-foreground/80 transition-colors group-hover:text-foreground" />
			</PopoverTrigger>
			<PopoverContent align="start" className="w-auto">
				<Calendar className="p-0" mode="single" onSelect={setSelectedDate} selected={date} />

				<Separator />

				<FieldGroup className="grid grid-cols-2 gap-2.5">
					<Field className="gap-1.5">
						<FieldLabel htmlFor={startTimeId}>Start Time</FieldLabel>
						<InputGroup>
							<InputGroupInput className={TIME_INPUT_CLASS_NAME} defaultValue={DEFAULT_START_TIME} id={startTimeId} step={TIME_STEP_SECONDS} type="time" />
							<InputGroupAddon>
								<ClockIcon />
							</InputGroupAddon>
						</InputGroup>
					</Field>
					<Field className="gap-1.5">
						<FieldLabel htmlFor={endTimeId}>End Time</FieldLabel>
						<InputGroup>
							<InputGroupInput className={TIME_INPUT_CLASS_NAME} defaultValue={DEFAULT_END_TIME} id={endTimeId} step={TIME_STEP_SECONDS} type="time" />
							<InputGroupAddon>
								<ClockIcon />
							</InputGroupAddon>
						</InputGroup>
					</Field>
				</FieldGroup>
			</PopoverContent>
		</Popover>
	);
}
