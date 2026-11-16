import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select";

export function NativeSelectDont2Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="native-select-dont-2">Department</FieldLabel>
			<NativeSelect id="native-select-dont-2" defaultValue="">
				<NativeSelectOption value="" />
				<NativeSelectOption value="sales">Sales</NativeSelectOption>
				<NativeSelectOption value="support">Support</NativeSelectOption>
			</NativeSelect>
		</Field>
	);
}
