import { RadioGroup } from "@workspace/ui-native/components/radio-group";
import * as React from "react";

const OPTIONS = [
	{ value: "standard", label: "Standard" },
	{ value: "express", label: "Express" },
];

export function RadioGroupDo2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("standard");
	return <RadioGroup label="Shipping" options={OPTIONS} value={value} onChange={setValue} />;
}
