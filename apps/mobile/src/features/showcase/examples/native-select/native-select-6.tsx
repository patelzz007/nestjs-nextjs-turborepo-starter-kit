import { NativeSelect, type NativeSelectOption } from "@workspace/ui-native/components/native-select";
import * as React from "react";

const FRUITS: readonly NativeSelectOption<string>[] = [
	{ value: "apple", label: "Apple" },
	{ value: "banana", label: "Banana" },
	{ value: "grapes", label: "Grapes", disabled: true },
	{ value: "mango", label: "Mango" },
	{ value: "pear", label: "Pear" },
];

export function NativeSelect6Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return <NativeSelect label="Fruit" options={FRUITS} value={value} onChange={setValue} invalid placeholder="Pick a fruit" />;
}
