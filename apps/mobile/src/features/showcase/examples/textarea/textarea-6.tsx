import { Field } from "@workspace/ui-native/components/field";
import { Textarea } from "@workspace/ui-native/components/textarea";
import * as React from "react";
import { Text } from "react-native";

/** The longest bio, and how close to it the count turns to a warning. */
const MAX = 280;
const WARN_AT = 20;

export function Textarea6Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	const left = MAX - value.length;
	return (
		<Field
			label="Bio"
			labelTrailing={<Text className={`text-caption font-sans tabular-nums ${left <= WARN_AT ? "text-warning-foreground" : "text-muted-foreground"}`}>{String(left)}</Text>}>
			<Textarea value={value} onChange={setValue} maxLength={MAX} size="sm" />
		</Field>
	);
}
