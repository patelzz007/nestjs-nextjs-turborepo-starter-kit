import { Avatar } from "@workspace/ui-native/components/avatar";
import { RadioGroup, type RadioOption } from "@workspace/ui-native/components/radio-group";
import * as React from "react";

const PEOPLE: readonly RadioOption<string>[] = [
	{ value: "avery", label: "Avery Chen", description: "@avery", leading: <Avatar name="Avery Chen" imageUrl={null} size="md" /> },
	{ value: "jordan", label: "Jordan Lee", description: "@jordan", leading: <Avatar name="Jordan Lee" imageUrl={null} size="md" /> },
];

export function RadioGroup12Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("avery");
	return <RadioGroup label="Reviewer" options={PEOPLE} value={value} onChange={setValue} variant="card" controlPosition="end" />;
}
