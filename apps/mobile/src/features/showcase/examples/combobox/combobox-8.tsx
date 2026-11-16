import { Combobox, type ComboboxOption } from "@workspace/ui-native/components/combobox";
import * as React from "react";

/** How many generated rows the list holds: enough to show it scrolls and narrows (the sheet's list is virtualized). */
const ITEM_COUNT = 100;

const ITEMS: readonly ComboboxOption<string>[] = Array.from({ length: ITEM_COUNT }, (_item: undefined, index: number): ComboboxOption<string> => ({
	value: `item-${String(index + 1)}`,
	label: `Item ${String(index + 1)}`,
}));

export function Combobox8Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return <Combobox label="Item" options={ITEMS} value={value} onChange={setValue} placeholder="Search 100 items" />;
}
