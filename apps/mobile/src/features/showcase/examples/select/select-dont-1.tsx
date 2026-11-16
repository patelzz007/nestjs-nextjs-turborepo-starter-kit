import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";

const ANSWERS: readonly SelectOption<string>[] = [
	{ value: "yes", label: "Yes" },
	{ value: "no", label: "No" },
];

export function SelectDont1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return <SelectField label="Subscribe" options={ANSWERS} value={value} onChange={setValue} placeholder="Choose" />;
}
