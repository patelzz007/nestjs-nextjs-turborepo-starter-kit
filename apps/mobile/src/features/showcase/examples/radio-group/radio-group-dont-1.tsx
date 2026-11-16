import { RadioGroup } from "@workspace/ui-native/components/radio-group";
import * as React from "react";

const MANY = ["Malaysia", "Singapore", "Indonesia", "Thailand", "Vietnam", "Philippines", "Brunei", "Cambodia", "Laos", "Myanmar"].map((label: string) => ({
	value: label.toLowerCase(),
	label,
}));

export function RadioGroupDont1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("my");
	return <RadioGroup label="Country" options={MANY} value={value} onChange={setValue} />;
}
