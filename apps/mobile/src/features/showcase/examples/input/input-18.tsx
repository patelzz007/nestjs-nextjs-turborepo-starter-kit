import { Badge } from "@workspace/ui-native/components/badge";
import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

export function Input18Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="Middle name" labelTrailing={<Badge label="Optional" variant="outline" size="sm" />}>
			<Input value={value} onChange={setValue} />
		</Field>
	);
}
