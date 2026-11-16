import * as React from "react";
import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field";
import { MultiDatePicker } from "@workspace/ui/components/multi-date-picker";

/** Nothing picked yet. */
const NO_DAYS: readonly string[] = [];

export function MultiDatePickerDo1Example(): React.JSX.Element {
	const [days, setDays] = React.useState<readonly string[]>(NO_DAYS);
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="multi-date-picker-do-1">Interview days</FieldLabel>
			<MultiDatePicker id="multi-date-picker-do-1" value={days} onValueChange={setDays} maxDates={3} placeholder="Pick days" aria-describedby="multi-date-picker-do-1-hint" />
			<FieldDescription id="multi-date-picker-do-1-hint">Pick up to 3 days.</FieldDescription>
		</Field>
	);
}
