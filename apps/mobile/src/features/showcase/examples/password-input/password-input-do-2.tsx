import { Field } from "@workspace/ui-native/components/field";
import { PasswordInput } from "@workspace/ui-native/components/password-input";
import * as React from "react";

export function PasswordInputDo2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="Password">
			<PasswordInput value={value} onChange={setValue} />
		</Field>
	);
}
