import { Badge } from "@workspace/ui-native/components/badge";
import { RadioGroup, type RadioOption } from "@workspace/ui-native/components/radio-group";
import * as React from "react";

const CHANNELS: readonly RadioOption<string>[] = [
	{ value: "stable", label: "Stable", trailing: <Badge label="Recommended" size="sm" /> },
	{ value: "beta", label: "Beta", trailing: <Badge label="Early" tone="warning" size="sm" /> },
];

export function RadioGroup15Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("stable");
	return <RadioGroup label="Release channel" options={CHANNELS} value={value} onChange={setValue} />;
}
