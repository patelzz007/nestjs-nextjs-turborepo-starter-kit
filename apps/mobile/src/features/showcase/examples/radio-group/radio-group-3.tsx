import { RadioGroup, type RadioOption } from "@workspace/ui-native/components/radio-group";
import * as React from "react";

const DESCRIBED: readonly RadioOption<string>[] = [
	{ value: "default", label: "Default", description: "The standard spacing." },
	{ value: "comfortable", label: "Comfortable", description: "More room between rows." },
	{ value: "compact", label: "Compact", description: "Fits more on the screen." },
];

export function RadioGroup3Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("comfortable");
	return <RadioGroup label="Density" options={DESCRIBED} value={value} onChange={setValue} />;
}
