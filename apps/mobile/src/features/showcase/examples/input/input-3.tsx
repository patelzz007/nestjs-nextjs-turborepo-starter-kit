import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

export function Input3Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="Username" hint="Letters, digits and dashes; you can change it later.">
			<Input value={value} onChange={setValue} autoCapitalize="none" />
		</Field>
	);
}
