import type { LocalDate } from "@workspace/shared";
import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import { Calendar } from "@workspace/ui-native/components/calendar";
import * as React from "react";
import { View } from "react-native";

import { SAMPLE_LOCALE, SAMPLE_MAX_DATE, SAMPLE_TODAY } from "../example-support";

/** Half hour slots from 09:00 to 17:30. */
const SLOTS: readonly string[] = [
	"09:00",
	"09:30",
	"10:00",
	"10:30",
	"11:00",
	"11:30",
	"12:00",
	"12:30",
	"13:00",
	"13:30",
	"14:00",
	"14:30",
	"15:00",
	"15:30",
	"16:00",
	"16:30",
	"17:00",
	"17:30",
];
/** Slots someone already took. */
const TAKEN: readonly string[] = ["10:00", "12:30", "15:00"];

const SLOT_OPTIONS: readonly ToggleGroupOption<string>[] = SLOTS.map((slot: string): ToggleGroupOption<string> => ({
	value: slot,
	label: slot,
	disabled: TAKEN.includes(slot),
}));

export function Calendar14Example(): React.JSX.Element {
	const [day, setDay] = React.useState<LocalDate | null>(SAMPLE_TODAY);
	const [slot, setSlot] = React.useState<string | null>(null);
	return (
		<View className="gap-4">
			<Calendar today={SAMPLE_TODAY} minDate={SAMPLE_TODAY} maxDate={SAMPLE_MAX_DATE} locale={SAMPLE_LOCALE} value={day} onChange={setDay} />
			<ToggleGroup type="single" label="Time" options={SLOT_OPTIONS} value={slot} onChange={setSlot} variant="outline" size="sm" />
		</View>
	);
}
