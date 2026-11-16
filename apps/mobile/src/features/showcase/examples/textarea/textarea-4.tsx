import { Field } from "@workspace/ui-native/components/field";
import { Textarea } from "@workspace/ui-native/components/textarea";
import * as React from "react";

export function Textarea4Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="Feedback" hint="Tell us what worked and what did not.">
			<Textarea value={value} onChange={setValue} />
		</Field>
	);
}
