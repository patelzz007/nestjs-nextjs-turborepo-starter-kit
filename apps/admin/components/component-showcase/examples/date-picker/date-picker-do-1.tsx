import * as React from "react";
import { DatePicker } from "@workspace/ui/components/date-picker";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { formatDateInputString } from "@workspace/ui/lib/form/date-input";
import { useSampleNow } from "@/components/component-showcase/examples/sample-clock";

export function DatePickerDo1Example(): React.JSX.Element {
	const today = new Date(useSampleNow());
	const [date, setDate] = React.useState<string>("");
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="date-picker-do-1">Delivery date</FieldLabel>
			<DatePicker id="date-picker-do-1" value={date} onValueChange={setDate} placeholder="Pick a date" fromDate={formatDateInputString(today)} />
		</Field>
	);
}
