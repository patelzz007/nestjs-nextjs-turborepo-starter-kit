import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";

export function RadioGroup1Example(): React.JSX.Element {
	return (
		<RadioGroup defaultValue="comfortable" className="w-fit">
			<Field orientation="horizontal">
				<RadioGroupItem value="default" id="r1" />
				<FieldLabel htmlFor="r1">Default</FieldLabel>
			</Field>
			<Field orientation="horizontal">
				<RadioGroupItem value="comfortable" id="r2" />
				<FieldLabel htmlFor="r2">Comfortable</FieldLabel>
			</Field>
			<Field orientation="horizontal">
				<RadioGroupItem value="compact" id="r3" />
				<FieldLabel htmlFor="r3">Compact</FieldLabel>
			</Field>
		</RadioGroup>
	);
}
