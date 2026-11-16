import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

export function Label6Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="Phone number" optional="optional">
			<Input value={value} onChange={setValue} keyboardType="phone-pad" />
		</Field>
	);
}
