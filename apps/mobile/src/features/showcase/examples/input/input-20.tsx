import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

export function Input20Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="Name" orientation="horizontal">
			<Input value={value} onChange={setValue} />
		</Field>
	);
}
