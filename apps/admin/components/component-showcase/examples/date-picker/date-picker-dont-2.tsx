import * as React from "react";
import { DatePicker } from "@workspace/ui/components/date-picker";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";

export function DatePickerDont2Example(): React.JSX.Element {
	const [date, setDate] = React.useState<string>("");
	return (
		<Field data-invalid className="w-full max-w-xs">
			<FieldLabel htmlFor="date-picker-dont-2">Delivery date</FieldLabel>
			<DatePicker id="date-picker-dont-2" value={date} onValueChange={setDate} placeholder="Pick a date" aria-invalid aria-describedby="date-picker-dont-2-error" />
			<FieldError id="date-picker-dont-2-error">Invalid.</FieldError>
		</Field>
	);
}
