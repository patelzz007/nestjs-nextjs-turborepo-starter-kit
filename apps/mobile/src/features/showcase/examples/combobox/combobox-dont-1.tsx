import { Combobox, type ComboboxOption } from "@workspace/ui-native/components/combobox";
import * as React from "react";

const SIZES: readonly ComboboxOption<string>[] = [
	{ value: "s", label: "Small" },
	{ value: "m", label: "Medium" },
	{ value: "l", label: "Large" },
];

export function ComboboxDont1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return <Combobox label="Size" options={SIZES} value={value} onChange={setValue} placeholder="Search sizes" />;
}
