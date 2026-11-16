import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

export function Input5Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("avery@");
	return (
		<Field label="Email" error="Enter a valid email address.">
			<Input value={value} onChange={setValue} keyboardType="email-address" autoCapitalize="none" />
		</Field>
	);
}
