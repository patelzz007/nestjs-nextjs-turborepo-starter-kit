import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";

const PLANS: readonly SelectOption<string>[] = [
	{ value: "starter", label: "Starter", description: "Perfect for individuals getting started." },
	{ value: "professional", label: "Professional", description: "Ideal for growing teams and businesses." },
	{ value: "enterprise", label: "Enterprise", description: "Advanced features for large organizations." },
];

export function Select6Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("starter");
	return <SelectField label="Plan" options={PLANS} value={value} onChange={setValue} />;
}
