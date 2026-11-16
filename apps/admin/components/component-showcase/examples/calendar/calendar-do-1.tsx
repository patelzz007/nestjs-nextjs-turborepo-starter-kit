import * as React from "react";
import { DatePicker } from "@workspace/ui/components/date-picker";
import { Field, FieldLabel } from "@workspace/ui/components/field";

export function CalendarDo1Example(): React.JSX.Element {
	const [date, setDate] = React.useState<string>("");
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="calendar-do-1">Start date</FieldLabel>
			<DatePicker id="calendar-do-1" value={date} onValueChange={setDate} placeholder="Pick a date" />
		</Field>
	);
}
