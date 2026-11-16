import * as React from "react";
import { DatePicker } from "@workspace/ui/components/date-picker";
import { Field, FieldLabel } from "@workspace/ui/components/field";

export function DateSelectorDo2Example(): React.JSX.Element {
	const [date, setDate] = React.useState<string>("");
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="date-selector-do-2">Birthday</FieldLabel>
			<DatePicker id="date-selector-do-2" value={date} onValueChange={setDate} placeholder="Pick a date" />
		</Field>
	);
}
