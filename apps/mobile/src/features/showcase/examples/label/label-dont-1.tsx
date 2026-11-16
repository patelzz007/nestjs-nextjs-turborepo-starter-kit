import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

export function LabelDont1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="Please enter the email address you use for work">
			<Input value={value} onChange={setValue} />
		</Field>
	);
}
