import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { MultiDatePicker } from "@workspace/ui/components/multi-date-picker";

/** Nothing picked yet. */
const NO_DAYS: readonly string[] = [];

export function MultiDatePickerDont2Example(): React.JSX.Element {
	const [days, setDays] = React.useState<readonly string[]>(NO_DAYS);
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="multi-date-picker-dont-2">Trip days</FieldLabel>
			<MultiDatePicker id="multi-date-picker-dont-2" value={days} onValueChange={setDays} placeholder="Pick every day of the trip" />
		</Field>
	);
}
