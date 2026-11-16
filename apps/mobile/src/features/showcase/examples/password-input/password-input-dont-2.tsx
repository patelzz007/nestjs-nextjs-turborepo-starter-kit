import { Field } from "@workspace/ui-native/components/field";
import { PasswordInput } from "@workspace/ui-native/components/password-input";
import * as React from "react";

export function PasswordInputDont2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("hunter2");
	return (
		<Field label="Password">
			<PasswordInput value={value} onChange={setValue} visible />
		</Field>
	);
}
