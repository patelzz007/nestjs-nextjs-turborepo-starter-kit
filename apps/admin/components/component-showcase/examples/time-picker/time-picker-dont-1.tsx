import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { TimePicker } from "@workspace/ui/components/time-picker";

export function TimePickerDont1Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel id="time-picker-dont-1-label" htmlFor="time-picker-dont-1">
				Slot
			</FieldLabel>
			<TimePicker id="time-picker-dont-1" defaultValue="10:30" aria-labelledby="time-picker-dont-1-label" />
		</Field>
	);
}
