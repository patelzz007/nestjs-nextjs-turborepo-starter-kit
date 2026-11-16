import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

/** The rules the code fails. */
const ERRORS: readonly string[] = ["At least 8 characters.", "At least one number.", "At least one symbol."];

export function Input21Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("abc");
	return (
		<Field label="Security code" errors={ERRORS}>
			<Input value={value} onChange={setValue} autoCapitalize="none" />
		</Field>
	);
}
