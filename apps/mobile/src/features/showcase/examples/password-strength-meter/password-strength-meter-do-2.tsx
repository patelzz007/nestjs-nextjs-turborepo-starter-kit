import { Field } from "@workspace/ui-native/components/field";
import { PasswordInput } from "@workspace/ui-native/components/password-input";
import * as React from "react";

export function PasswordStrengthMeterDo2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="New password">
			<PasswordInput value={value} onChange={setValue} />
		</Field>
	);
}
