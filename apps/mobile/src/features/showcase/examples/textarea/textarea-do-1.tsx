import { Field } from "@workspace/ui-native/components/field";
import { Textarea } from "@workspace/ui-native/components/textarea";
import * as React from "react";

export function TextareaDo1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="Feedback">
			<Textarea value={value} onChange={setValue} size="md" />
		</Field>
	);
}
