import { addLocalDays, type LocalDate } from "@workspace/shared";
import { Button } from "@workspace/ui-native/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import { calendarDayMsOf } from "@workspace/ui-native/lib/calendar";
import { Calendar } from "@workspace/ui-native/components/calendar";
import * as React from "react";
import { Text } from "react-native";

import { ignorePress, SAMPLE_LOCALE, SAMPLE_MAX_DATE, SAMPLE_TODAY } from "../example-support";

const TITLE = "Book an appointment";
const DESCRIPTION = "Pick a day, then a time.";

/** 15 minute slots from 09:00 to 18:00. */
const FIRST_HOUR = 9;
const LAST_HOUR = 18;
const SLOT_MINUTES = 15;
const MINUTES_PER_HOUR = 60;
const SLOT_COUNT = ((LAST_HOUR - FIRST_HOUR) * MINUTES_PER_HOUR) / SLOT_MINUTES;
const TWO_DIGITS = 2;

function slotAt(index: number): string {
	const minutes = FIRST_HOUR * MINUTES_PER_HOUR + index * SLOT_MINUTES;
	return `${String(Math.floor(minutes / MINUTES_PER_HOUR)).padStart(TWO_DIGITS, "0")}:${String(minutes % MINUTES_PER_HOUR).padStart(TWO_DIGITS, "0")}`;
}

const SLOT_OPTIONS: readonly ToggleGroupOption<string>[] = Array.from({ length: SLOT_COUNT }, (_slot: undefined, index: number): ToggleGroupOption<string> => ({
	value: slotAt(index),
	label: slotAt(index),
}));

/** Today and two more days are fully booked. */
const BOOKED_DAYS: readonly LocalDate[] = [SAMPLE_TODAY, addLocalDays(SAMPLE_TODAY, 3), addLocalDays(SAMPLE_TODAY, 5)];

function isBooked(day: LocalDate): boolean {
	return BOOKED_DAYS.includes(day);
}

const LONG_DATE = new Intl.DateTimeFormat(SAMPLE_LOCALE, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export function Calendar19Example(): React.JSX.Element {
	const [day, setDay] = React.useState<LocalDate | null>(null);
	const [slot, setSlot] = React.useState<string | null>(null);
	const summary = day === null || slot === null ? "Pick a day and a time." : `${LONG_DATE.format(calendarDayMsOf(day))} at ${slot}`;
	return (
		<Card>
			<CardHeader>
				<CardTitle>{TITLE}</CardTitle>
				<CardDescription>{DESCRIPTION}</CardDescription>
			</CardHeader>
			<CardContent className="gap-4">
				<Calendar today={SAMPLE_TODAY} minDate={SAMPLE_TODAY} maxDate={SAMPLE_MAX_DATE} locale={SAMPLE_LOCALE} value={day} onChange={setDay} isUnavailable={isBooked} />
				<ToggleGroup type="single" label="Time" options={SLOT_OPTIONS} value={slot} onChange={setSlot} variant="outline" size="sm" disabled={day === null} />
			</CardContent>
			<CardFooter className="gap-3">
				<Text className="text-body flex-1 font-sans text-muted-foreground">{summary}</Text>
				<Button label="Confirm" disabled={day === null || slot === null} onPress={ignorePress} />
			</CardFooter>
		</Card>
	);
}
