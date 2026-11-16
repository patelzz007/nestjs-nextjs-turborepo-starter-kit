import { RadioGroup, type RadioOption } from "@workspace/ui-native/components/radio-group";
import * as React from "react";

const DENSITY: readonly RadioOption<string>[] = [
	{ value: "default", label: "Default" },
	{ value: "comfortable", label: "Comfortable" },
	{ value: "compact", label: "Compact" },
];

export function RadioGroup1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("comfortable");
	return <RadioGroup label="Density" options={DENSITY} value={value} onChange={setValue} />;
}
