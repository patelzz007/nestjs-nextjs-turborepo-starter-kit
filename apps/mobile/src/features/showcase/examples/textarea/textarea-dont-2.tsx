import { Field } from "@workspace/ui-native/components/field";
import { Textarea } from "@workspace/ui-native/components/textarea";
import * as React from "react";

export function TextareaDont2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="Bio">
			<Textarea value={value} onChange={setValue} maxLength={160} />
		</Field>
	);
}
