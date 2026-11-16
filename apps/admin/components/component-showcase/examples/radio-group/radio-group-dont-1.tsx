import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";

export function RadioGroupDont1Example(): React.JSX.Element {
	return (
		<RadioGroup aria-label="Country" defaultValue="austria" className="w-fit">
			<Field orientation="horizontal">
				<RadioGroupItem value="austria" id="radio-group-dont-1-austria" />
				<FieldLabel htmlFor="radio-group-dont-1-austria">Austria</FieldLabel>
			</Field>
			<Field orientation="horizontal">
				<RadioGroupItem value="belgium" id="radio-group-dont-1-belgium" />
				<FieldLabel htmlFor="radio-group-dont-1-belgium">Belgium</FieldLabel>
			</Field>
			<Field orientation="horizontal">
				<RadioGroupItem value="croatia" id="radio-group-dont-1-croatia" />
				<FieldLabel htmlFor="radio-group-dont-1-croatia">Croatia</FieldLabel>
			</Field>
			<Field orientation="horizontal">
				<RadioGroupItem value="denmark" id="radio-group-dont-1-denmark" />
				<FieldLabel htmlFor="radio-group-dont-1-denmark">Denmark</FieldLabel>
			</Field>
			<Field orientation="horizontal">
				<RadioGroupItem value="estonia" id="radio-group-dont-1-estonia" />
				<FieldLabel htmlFor="radio-group-dont-1-estonia">Estonia</FieldLabel>
			</Field>
			<Field orientation="horizontal">
				<RadioGroupItem value="finland" id="radio-group-dont-1-finland" />
				<FieldLabel htmlFor="radio-group-dont-1-finland">Finland</FieldLabel>
			</Field>
			<Field orientation="horizontal">
				<RadioGroupItem value="france" id="radio-group-dont-1-france" />
				<FieldLabel htmlFor="radio-group-dont-1-france">France</FieldLabel>
			</Field>
			<Field orientation="horizontal">
				<RadioGroupItem value="germany" id="radio-group-dont-1-germany" />
				<FieldLabel htmlFor="radio-group-dont-1-germany">Germany</FieldLabel>
			</Field>
			<Field orientation="horizontal">
				<RadioGroupItem value="greece" id="radio-group-dont-1-greece" />
				<FieldLabel htmlFor="radio-group-dont-1-greece">Greece</FieldLabel>
			</Field>
			<Field orientation="horizontal">
				<RadioGroupItem value="ireland" id="radio-group-dont-1-ireland" />
				<FieldLabel htmlFor="radio-group-dont-1-ireland">Ireland</FieldLabel>
			</Field>
			<Field orientation="horizontal">
				<RadioGroupItem value="italy" id="radio-group-dont-1-italy" />
				<FieldLabel htmlFor="radio-group-dont-1-italy">Italy</FieldLabel>
			</Field>
			<Field orientation="horizontal">
				<RadioGroupItem value="latvia" id="radio-group-dont-1-latvia" />
				<FieldLabel htmlFor="radio-group-dont-1-latvia">Latvia</FieldLabel>
			</Field>
		</RadioGroup>
	);
}
