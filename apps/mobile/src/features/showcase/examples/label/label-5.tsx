import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

export function Label5Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="Email" required>
			<Input value={value} onChange={setValue} keyboardType="email-address" autoCapitalize="none" />
		</Field>
	);
}
