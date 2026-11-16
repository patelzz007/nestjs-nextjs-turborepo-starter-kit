import { NativeSelect, type NativeSelectOption } from "@workspace/ui-native/components/native-select";
import * as React from "react";

const PRODUCE: readonly NativeSelectOption<string>[] = [
	{ value: "apple", label: "Apple", group: "Fruits" },
	{ value: "banana", label: "Banana", group: "Fruits" },
	{ value: "mango", label: "Mango", group: "Fruits" },
	{ value: "carrot", label: "Carrot", group: "Vegetables" },
	{ value: "leek", label: "Leek", group: "Vegetables" },
	{ value: "pea", label: "Pea", group: "Vegetables" },
];

export function NativeSelect2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return <NativeSelect label="Produce" options={PRODUCE} value={value} onChange={setValue} placeholder="Pick one" />;
}
