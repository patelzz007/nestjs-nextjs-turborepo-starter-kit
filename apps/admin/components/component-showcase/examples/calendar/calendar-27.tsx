"use client";

import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { format, startOfToday } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type * as React from "react";
import { useCallback, useMemo, useState } from "react";

/** react-day-picker's `disabled` matchers, read off the kit Calendar's own props. */
type DisabledMatchers = React.ComponentProps<typeof Calendar>["disabled"];

interface TimeSlot {
	readonly time: string;
	readonly available: boolean;
}

/** Sample availability for the picked day. */
const TIME_SLOTS: readonly TimeSlot[] = [
	{ available: false, time: "09:00" },
	{ available: false, time: "09:30" },
	{ available: true, time: "10:00" },
	{ available: true, time: "10:30" },
	{ available: true, time: "11:00" },
	{ available: true, time: "11:30" },
	{ available: false, time: "12:00" },
	{ available: true, time: "12:30" },
	{ available: true, time: "13:00" },
	{ available: true, time: "13:30" },
	{ available: true, time: "14:00" },
	{ available: false, time: "14:30" },
	{ available: false, time: "15:00" },
	{ available: true, time: "15:30" },
	{ available: true, time: "16:00" },
	{ available: true, time: "16:30" },
	{ available: true, time: "17:00" },
	{ available: true, time: "17:30" },
];

const TRIGGER_BUTTON = <Button className="group/pick-date w-60 justify-between" variant="outline" />;

interface TimeSlotButtonProps {
	readonly slot: TimeSlot;
	readonly isSelected: boolean;
	readonly onPick: (time: string) => void;
}

function TimeSlotButton({ slot, isSelected, onPick }: TimeSlotButtonProps): React.JSX.Element {
	const handleClick = useCallback((): void => {
		onPick(slot.time);
	}, [onPick, slot.time]);

	return (
		<Button className="w-full" disabled={!slot.available} onClick={handleClick} size="sm" variant={isSelected ? "default" : "outline"}>
			{slot.time}
		</Button>
	);
}

export function Calendar27Example(): React.JSX.Element {
	const [today] = useState<Date>(startOfToday);
	const [date, setDate] = useState<Date>(today);
	const [time, setTime] = useState<string | null>(null);
	const disabled = useMemo((): DisabledMatchers => [{ before: today }], [today]);

	const handleSelect = useCallback((newDate: Date | undefined): void => {
		if (newDate !== undefined) {
			setDate(newDate);
			setTime(null);
		}
	}, []);

	return (
		<Popover>
			<PopoverTrigger render={TRIGGER_BUTTON}>
				<span className="truncate">{format(date, "LLL dd, y")}</span>
				<CalendarIcon aria-hidden="true" className="shrink-0 text-muted-foreground/80 transition-colors group-hover:text-foreground" />
			</PopoverTrigger>
			<PopoverContent align="start" className="w-auto p-0">
				<Card className="p-0">
					<CardContent className="p-0">
						<div className="flex max-sm:flex-col">
							<Calendar disabled={disabled} mode="single" onSelect={handleSelect} selected={date} />
							<div className="relative w-full max-sm:h-48 sm:w-40">
								<div className="absolute inset-0 py-4 max-sm:border-t">
									<ScrollArea className="h-full sm:border-s">
										<div className="space-y-3">
											<div className="flex h-5 shrink-0 items-center px-5">
												<p className="text-sm font-medium">{format(date, "EEEE, d")}</p>
											</div>
											<div className="grid gap-1.5 px-5 max-sm:grid-cols-2">
												{TIME_SLOTS.map((slot: TimeSlot): React.JSX.Element => (
													<TimeSlotButton isSelected={time === slot.time} key={slot.time} onPick={setTime} slot={slot} />
												))}
											</div>
										</div>
									</ScrollArea>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			</PopoverContent>
		</Popover>
	);
}
