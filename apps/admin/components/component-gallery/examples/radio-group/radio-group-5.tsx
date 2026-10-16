import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";

export function RadioGroup5Example(): React.JSX.Element {
	return (
		<RadioGroup defaultValue="blue" className="w-fit">
			<Field orientation="horizontal">
				<RadioGroupItem value="blue" id="color-blue" className="border-info data-checked:border-info [&_[data-slot=radio-group-indicator]]:text-info" />
				<FieldLabel htmlFor="color-blue">Blue</FieldLabel>
			</Field>
			<Field orientation="horizontal">
				<RadioGroupItem value="green" id="color-green" className="border-success data-checked:border-success [&_[data-slot=radio-group-indicator]]:text-success" />
				<FieldLabel htmlFor="color-green">Green</FieldLabel>
			</Field>
			<Field orientation="horizontal">
				<RadioGroupItem value="yellow" id="color-yellow" className="border-warning data-checked:border-warning [&_[data-slot=radio-group-indicator]]:text-warning" />
				<FieldLabel htmlFor="color-yellow">Yellow</FieldLabel>
			</Field>
		</RadioGroup>
	);
}
