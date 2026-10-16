import * as React from "react";
import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select";

export function NativeSelect4Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="native-select-country">Country</FieldLabel>
			<NativeSelect id="native-select-country">
				<NativeSelectOption value="">Select a country</NativeSelectOption>
				<NativeSelectOption value="us">United States</NativeSelectOption>
				<NativeSelectOption value="uk">United Kingdom</NativeSelectOption>
				<NativeSelectOption value="ca">Canada</NativeSelectOption>
			</NativeSelect>
			<FieldDescription>Select your country of residence.</FieldDescription>
		</Field>
	);
}
