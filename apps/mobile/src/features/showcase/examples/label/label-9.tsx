import { Field } from "@workspace/ui-native/components/field";
import { Textarea } from "@workspace/ui-native/components/textarea";
import * as React from "react";
import { Text } from "react-native";

/** The longest bio. */
const MAX = 200;

export function Label9Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="Bio" labelTrailing={<Text className="text-caption font-sans text-muted-foreground tabular-nums">{`${String(value.length)}/${String(MAX)}`}</Text>}>
			<Textarea value={value} onChange={setValue} maxLength={MAX} />
		</Field>
	);
}
