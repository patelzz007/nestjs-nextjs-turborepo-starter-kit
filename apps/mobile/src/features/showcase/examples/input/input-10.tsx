import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

/** Keeps only the digits of what is typed. */
function digitsOnly(text: string): string {
	return text.replace(/\D/gu, "");
}

export function Input10Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="Quantity">
			<Input value={value} onChange={setValue} keyboardType="number-pad" normalize={digitsOnly} />
		</Field>
	);
}
