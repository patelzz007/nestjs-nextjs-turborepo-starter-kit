import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";

const PRODUCE: readonly SelectOption<string>[] = [
	{ value: "apple", label: "Apple", group: "Fruits" },
	{ value: "banana", label: "Banana", group: "Fruits" },
	{ value: "blueberry", label: "Blueberry", group: "Fruits" },
	{ value: "carrot", label: "Carrot", group: "Vegetables" },
	{ value: "broccoli", label: "Broccoli", group: "Vegetables" },
	{ value: "spinach", label: "Spinach", group: "Vegetables" },
];

export function Select3Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return <SelectField label="Produce" options={PRODUCE} value={value} onChange={setValue} placeholder="Select an option" />;
}
