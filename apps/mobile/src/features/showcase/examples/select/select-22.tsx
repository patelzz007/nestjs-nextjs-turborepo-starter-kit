import ChevronsUpDownIcon from "lucide-react-native/icons/chevrons-up-down";
import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";

const FRUITS: readonly SelectOption<string>[] = [
	{ value: "apple", label: "Apple" },
	{ value: "banana", label: "Banana" },
	{ value: "blueberry", label: "Blueberry" },
	{ value: "grapes", label: "Grapes" },
	{ value: "pineapple", label: "Pineapple" },
];

export function Select22Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	const clear = React.useCallback((): void => {
		setValue(null);
	}, []);
	return <SelectField label="Fruit" options={FRUITS} value={value} onChange={setValue} placeholder="Select a fruit" chevronIcon={ChevronsUpDownIcon} onClear={clear} />;
}
