import { Card } from "@workspace/ui-native/components/card";
import { RadioGroup, type RadioOption } from "@workspace/ui-native/components/radio-group";
import * as React from "react";

const SHIPPING: readonly RadioOption<string>[] = [
	{ value: "standard", label: "Standard", description: "4–6 business days" },
	{ value: "express", label: "Express", description: "2–3 business days" },
	{ value: "overnight", label: "Overnight", description: "Next business day" },
];

export function RadioGroup8Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("standard");
	return (
		<Card>
			<RadioGroup label="Shipping" options={SHIPPING} value={value} onChange={setValue} controlPosition="end" />
		</Card>
	);
}
