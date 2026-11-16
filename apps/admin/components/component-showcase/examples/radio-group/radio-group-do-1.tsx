import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";

export function RadioGroupDo1Example(): React.JSX.Element {
	return (
		<RadioGroup aria-label="Delivery" defaultValue="standard" className="w-fit">
			<Field orientation="horizontal">
				<RadioGroupItem value="standard" id="radio-group-do-1-standard" />
				<FieldLabel htmlFor="radio-group-do-1-standard">Standard — 3 to 5 days, free</FieldLabel>
			</Field>
			<Field orientation="horizontal">
				<RadioGroupItem value="express" id="radio-group-do-1-express" />
				<FieldLabel htmlFor="radio-group-do-1-express">Express — next day, $9</FieldLabel>
			</Field>
		</RadioGroup>
	);
}
