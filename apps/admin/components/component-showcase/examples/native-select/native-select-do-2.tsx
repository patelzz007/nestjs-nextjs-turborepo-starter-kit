import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select";

export function NativeSelectDo2Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="native-select-do-2">Department</FieldLabel>
			<NativeSelect id="native-select-do-2" defaultValue="">
				<NativeSelectOption value="" disabled>
					Choose a department
				</NativeSelectOption>
				<NativeSelectOption value="sales">Sales</NativeSelectOption>
				<NativeSelectOption value="support">Support</NativeSelectOption>
			</NativeSelect>
		</Field>
	);
}
