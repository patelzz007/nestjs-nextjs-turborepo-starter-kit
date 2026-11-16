import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";

export function RadioGroupDont2Example(): React.JSX.Element {
	return (
		<RadioGroup aria-label="Plan" defaultValue="premium" className="w-fit">
			<Field orientation="horizontal">
				<RadioGroupItem value="basic" id="radio-group-dont-2-basic" />
				<FieldLabel htmlFor="radio-group-dont-2-basic">Basic — $12</FieldLabel>
			</Field>
			<Field orientation="horizontal">
				<RadioGroupItem value="premium" id="radio-group-dont-2-premium" />
				<FieldLabel htmlFor="radio-group-dont-2-premium">Premium support — $90</FieldLabel>
			</Field>
		</RadioGroup>
	);
}
