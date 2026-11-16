import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";

const FRUITS: readonly SelectOption<string>[] = [
	{ value: "apple", label: "Apple" },
	{ value: "banana", label: "Banana" },
	{ value: "blueberry", label: "Blueberry" },
	{ value: "grapes", label: "Grapes" },
	{ value: "pineapple", label: "Pineapple" },
];

export function Select9Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return <SelectField label="Fruit" options={FRUITS} value={value} onChange={setValue} placeholder="Select a fruit" error="Please select a fruit." />;
}
