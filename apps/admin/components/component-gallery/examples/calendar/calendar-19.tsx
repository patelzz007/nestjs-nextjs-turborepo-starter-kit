"use client";

import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { addDays, startOfToday } from "date-fns";
import { CircleCheckIcon } from "lucide-react";
import type * as React from "react";
import { useCallback, useMemo, useState } from "react";

/** react-day-picker's `modifiers`, read off the kit Calendar's own props. */
type CalendarModifiers = React.ComponentProps<typeof Calendar>["modifiers"];

// Quarter-hour slots from 09:00 to 18:00 inclusive.
const FIRST_SLOT_HOUR = 9;
const SLOT_MINUTES = 15;
const MINUTES_PER_HOUR = 60;
const SLOT_COUNT = 37;
const TIME_PART_WIDTH = 2;
const DEFAULT_TIME = "10:00";
/** Today and the next two days are fully booked in the sample. */
const BOOKED_DAY_COUNT = 3;

function slotTime(index: number): string {
	const totalMinutes = index * SLOT_MINUTES;
	const hour = Math.floor(totalMinutes / MINUTES_PER_HOUR) + FIRST_SLOT_HOUR;
	const minute = totalMinutes % MINUTES_PER_HOUR;
	return `${String(hour).padStart(TIME_PART_WIDTH, "0")}:${String(minute).padStart(TIME_PART_WIDTH, "0")}`;
}

const TIME_SLOTS: readonly string[] = Array.from({ length: SLOT_COUNT }, (_slot: undefined, index: number): string => slotTime(index));

const BOOKING_DATE_FORMAT: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" };

interface TimeSlotButtonProps {
	readonly time: string;
	readonly isSelected: boolean;
	readonly onPick: (time: string) => void;
}

function TimeSlotButton({ time, isSelected, onPick }: TimeSlotButtonProps): React.JSX.Element {
	const handleClick = useCallback((): void => {
		onPick(time);
	}, [onPick, time]);

	return (
		<Button className="w-full shadow-none" onClick={handleClick} variant={isSelected ? "default" : "outline"}>
			{time}
		</Button>
	);
}

export function Calendar19Example(): React.JSX.Element {
	const [today] = useState<Date>(startOfToday);
	const [date, setDate] = useState<Date | undefined>(today);
	const [selectedTime, setSelectedTime] = useState<string>(DEFAULT_TIME);
	const bookedDates = useMemo((): Date[] => Array.from({ length: BOOKED_DAY_COUNT }, (_day: undefined, offset: number): Date => addDays(today, offset)), [today]);
	const modifiers = useMemo((): CalendarModifiers => ({ booked: bookedDates }), [bookedDates]);

	return (
		<Card className="gap-0 p-0">
			<CardHeader className="flex h-max items-center justify-start border-b px-4! py-3!">
				<CardTitle>Book your appointment</CardTitle>
			</CardHeader>
			<CardContent className="relative p-0 md:pr-48">
				<div className="p-4">
					<Calendar defaultMonth={today} disabled={bookedDates} mode="single" modifiers={modifiers} onSelect={setDate} selected={date} showOutsideDays={false} />
				</div>
				<div className="inset-y-0 right-0 flex w-full flex-col gap-4 border-t max-md:h-60 md:absolute md:w-48 md:border-t-0 md:border-l">
					<ScrollArea className="h-full">
						<div className="flex flex-col gap-2 p-4">
							{TIME_SLOTS.map((time: string): React.JSX.Element => (
								<TimeSlotButton isSelected={selectedTime === time} key={time} onPick={setSelectedTime} time={time} />
							))}
						</div>
					</ScrollArea>
				</div>
			</CardContent>
			<CardFooter className="flex flex-col gap-4 border-t px-4 py-3! md:flex-row">
				<div className="flex max-w-64 items-center gap-2 text-sm">
					{date === undefined ? (
						"Select a date and time for your meeting."
					) : (
						<>
							<CircleCheckIcon className="size-4 shrink-0" />
							<span className="text-sm">
								Your meeting is booked for <span className="font-medium">{date.toLocaleDateString("en-US", BOOKING_DATE_FORMAT)}</span> at{" "}
								<span className="font-medium">{selectedTime}</span>
							</span>
						</>
					)}
				</div>
				<Button className="w-full md:ml-auto md:w-auto" disabled={date === undefined} variant="outline">
					Confirm
				</Button>
			</CardFooter>
		</Card>
	);
}
