import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

export function Input9Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="Website">
			<Input value={value} onChange={setValue} keyboardType="url" autoCapitalize="none" placeholder="https://example.com" />
		</Field>
	);
}
