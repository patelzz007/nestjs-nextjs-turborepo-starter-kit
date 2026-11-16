import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

export function Input8Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="Phone">
			<Input value={value} onChange={setValue} keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" />
		</Field>
	);
}
