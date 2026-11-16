import type { LocalDate } from "@workspace/shared";
import { Button } from "@workspace/ui-native/components/button";
import { CalendarField } from "@workspace/ui-native/components/calendar-field";
import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import { calendarDayMsOf } from "@workspace/ui-native/lib/calendar";
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

/** How a picked day is written under the calendar. */
const LONG_DATE = new Intl.DateTimeFormat(SAMPLE_LOCALE, { dateStyle: "long", timeZone: "UTC" });

interface Appointment {
	readonly day: LocalDate | null;
	readonly slot: string | null;
}

interface AppointmentSheetProps {
	readonly value: Appointment;
	readonly onChange: (value: Appointment) => void;
	readonly close: () => void;
}

/** The sheet: a calendar from today on, then the day's free slots. */
function AppointmentSheet({ value, onChange, close }: AppointmentSheetProps): React.JSX.Element {
	const setDay = React.useCallback(
		(day: LocalDate): void => {
			onChange({ day, slot: null });
		},
		[onChange],
	);
	const setSlot = React.useCallback(
		(slot: string | null): void => {
			onChange({ day: value.day, slot });
		},
		[onChange, value.day],
	);
	return (
		<View className="gap-4">
			<Calendar today={SAMPLE_TODAY} minDate={SAMPLE_TODAY} maxDate={SAMPLE_MAX_DATE} locale={SAMPLE_LOCALE} value={value.day} onChange={setDay} />
			<ToggleGroup type="single" label="Time" options={SLOT_OPTIONS} value={value.slot} onChange={setSlot} variant="outline" size="sm" disabled={value.day === null} />
			<Button label="Done" disabled={value.slot === null} onPress={close} />
		</View>
	);
}

const NOTHING: Appointment = { day: null, slot: null };

export function Calendar27Example(): React.JSX.Element {
	const [appointment, setAppointment] = React.useState<Appointment>(NOTHING);
	const summary = appointment.day === null || appointment.slot === null ? null : `${LONG_DATE.format(calendarDayMsOf(appointment.day))}, ${appointment.slot}`;
	const renderSheet = React.useCallback(
		(close: () => void): React.JSX.Element => <AppointmentSheet value={appointment} onChange={setAppointment} close={close} />,
		[appointment],
	);
	return <CalendarField label="Appointment" summary={summary} placeholder="Pick a day and time" renderSheet={renderSheet} />;
}
