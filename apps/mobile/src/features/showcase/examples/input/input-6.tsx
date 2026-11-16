import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";
import { Text } from "react-native";

/** The longest description. */
const MAX = 50;

export function Input6Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="Description" labelTrailing={<Text className="text-caption font-sans text-muted-foreground tabular-nums">{`${String(value.length)}/${String(MAX)}`}</Text>}>
			<Input value={value} onChange={setValue} maxLength={MAX} />
		</Field>
	);
}
