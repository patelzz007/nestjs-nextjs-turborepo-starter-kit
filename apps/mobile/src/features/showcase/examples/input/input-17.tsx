import { Badge } from "@workspace/ui-native/components/badge";
import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

export function Input17Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="API key" labelTrailing={<Badge label="New" tone="success" size="sm" />}>
			<Input value={value} onChange={setValue} autoCapitalize="none" />
		</Field>
	);
}
