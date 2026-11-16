import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

export function Label10Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="API key" hint="Keep it secret: it signs every request.">
			<Input value={value} onChange={setValue} autoCapitalize="none" />
		</Field>
	);
}
