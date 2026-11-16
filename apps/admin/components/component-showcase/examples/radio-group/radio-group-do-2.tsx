import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";

export function RadioGroupDo2Example(): React.JSX.Element {
	return (
		<RadioGroup aria-label="Billing" defaultValue="monthly" className="w-fit">
			<Field orientation="horizontal">
				<RadioGroupItem value="monthly" id="radio-group-do-2-monthly" />
				<FieldLabel htmlFor="radio-group-do-2-monthly">Monthly — $12</FieldLabel>
			</Field>
			<Field orientation="horizontal">
				<RadioGroupItem value="yearly" id="radio-group-do-2-yearly" />
				<FieldLabel htmlFor="radio-group-do-2-yearly">Yearly — $120</FieldLabel>
			</Field>
		</RadioGroup>
	);
}
