import { FieldSet } from "@workspace/ui-native/components/field";
import { RadioGroup, type RadioOption } from "@workspace/ui-native/components/radio-group";
import * as React from "react";

const LEVELS: readonly RadioOption<string>[] = [
	{ value: "all", label: "All new messages" },
	{ value: "mentions", label: "Direct messages and mentions" },
	{ value: "none", label: "Nothing" },
];

export function RadioGroup6Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("mentions");
	return (
		<FieldSet legend="Notifications" description="Choose what you hear about.">
			<RadioGroup label="Notifications" options={LEVELS} value={value} onChange={setValue} />
		</FieldSet>
	);
}
