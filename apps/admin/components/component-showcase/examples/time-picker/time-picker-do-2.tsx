import * as React from "react";
import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field";
import { TimePicker } from "@workspace/ui/components/time-picker";

/** The times already taken. */
const BOOKED: ReadonlySet<string> = new Set(["10:00", "11:30", "14:00"]);

function isBooked(value: string): boolean {
	return BOOKED.has(value);
}

export function TimePickerDo2Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel id="time-picker-do-2-label" htmlFor="time-picker-do-2">
				Appointment
			</FieldLabel>
			<TimePicker
				id="time-picker-do-2"
				minuteStep={30}
				min="09:00"
				max="17:00"
				isTimeDisabled={isBooked}
				aria-labelledby="time-picker-do-2-label"
				aria-describedby="time-picker-do-2-hint"
			/>
			<FieldDescription id="time-picker-do-2-hint">Open 09:00 to 17:00. Booked times are greyed out.</FieldDescription>
		</Field>
	);
}
