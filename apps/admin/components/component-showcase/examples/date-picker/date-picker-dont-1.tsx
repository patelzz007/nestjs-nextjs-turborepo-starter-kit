import * as React from "react";
import { DatePicker } from "@workspace/ui/components/date-picker";
import { Field, FieldLabel } from "@workspace/ui/components/field";

export function DatePickerDont1Example(): React.JSX.Element {
	const [date, setDate] = React.useState<string>("");
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="date-picker-dont-1">Delivery date</FieldLabel>
			<DatePicker id="date-picker-dont-1" value={date} onValueChange={setDate} placeholder="Pick a date" />
		</Field>
	);
}
