import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";

/** How many generated rows the list holds: enough to show it scrolls (the sheet's list is virtualized). */
const ITEM_COUNT = 100;

const ITEMS: readonly SelectOption<string>[] = Array.from({ length: ITEM_COUNT }, (_item: undefined, index: number): SelectOption<string> => ({
	value: `item-${String(index + 1)}`,
	label: `Item ${String(index + 1)}`,
}));

export function Select4Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return <SelectField label="Item" options={ITEMS} value={value} onChange={setValue} placeholder="Select an item" />;
}
