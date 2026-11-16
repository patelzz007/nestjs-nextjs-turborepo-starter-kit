import { Field } from "@workspace/ui-native/components/field";
import { Textarea } from "@workspace/ui-native/components/textarea";
import * as React from "react";
import { Text } from "react-native";

export function TextareaDo2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="Bio" labelTrailing={<Text className="text-caption font-sans text-muted-foreground">{`${String(value.length)}/160`}</Text>}>
			<Textarea value={value} onChange={setValue} maxLength={160} />
		</Field>
	);
}
