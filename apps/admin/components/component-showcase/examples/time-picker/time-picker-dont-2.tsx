import * as React from "react";
import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field";
import { TimePicker } from "@workspace/ui/components/time-picker";

export function TimePickerDont2Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel id="time-picker-dont-2-label" htmlFor="time-picker-dont-2">
				Appointment
			</FieldLabel>
			<TimePicker id="time-picker-dont-2" minuteStep={30} defaultValue="22:30" aria-labelledby="time-picker-dont-2-label" aria-describedby="time-picker-dont-2-hint" />
			<FieldDescription id="time-picker-dont-2-hint" className="text-destructive">
				We are closed at 22:30. Pick another time.
			</FieldDescription>
		</Field>
	);
}
