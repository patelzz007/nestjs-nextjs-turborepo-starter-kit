import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select";

export function NativeSelectDo1Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="native-select-do-1">Shipping</FieldLabel>
			<NativeSelect id="native-select-do-1" defaultValue="standard">
				<NativeSelectOption value="standard">Standard (3–5 days)</NativeSelectOption>
				<NativeSelectOption value="express">Express (1–2 days)</NativeSelectOption>
				<NativeSelectOption value="pickup">Pick up in store</NativeSelectOption>
			</NativeSelect>
		</Field>
	);
}
