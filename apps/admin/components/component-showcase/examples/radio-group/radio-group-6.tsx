import * as React from "react";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@workspace/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";

export function RadioGroup6Example(): React.JSX.Element {
	return (
		<FieldSet className="w-full max-w-xs">
			<FieldLegend>Battery Level</FieldLegend>
			<FieldDescription>Choose your preferred battery level.</FieldDescription>
			<RadioGroup defaultValue="medium">
				<Field orientation="horizontal">
					<RadioGroupItem value="high" id="battery-high" />
					<FieldLabel htmlFor="battery-high">High</FieldLabel>
				</Field>
				<Field orientation="horizontal">
					<RadioGroupItem value="medium" id="battery-medium" />
					<FieldLabel htmlFor="battery-medium">Medium</FieldLabel>
				</Field>
				<Field orientation="horizontal">
					<RadioGroupItem value="low" id="battery-low" />
					<FieldLabel htmlFor="battery-low">Low</FieldLabel>
				</Field>
			</RadioGroup>
		</FieldSet>
	);
}
