import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

export function FieldDont2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("avery@");
	return (
		<Field label="Email" error="Invalid.">
			<Input value={value} onChange={setValue} />
		</Field>
	);
}
