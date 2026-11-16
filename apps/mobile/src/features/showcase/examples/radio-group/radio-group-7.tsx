import { RadioGroup, type RadioOption } from "@workspace/ui-native/components/radio-group";
import * as React from "react";

const PLANS: readonly RadioOption<string>[] = [
	{ value: "plus", label: "Plus", description: "For individuals and small teams." },
	{ value: "pro", label: "Pro", description: "For growing businesses." },
];

export function RadioGroup7Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("plus");
	return <RadioGroup label="Plan" options={PLANS} variant="card" value={value} onChange={setValue} />;
}
