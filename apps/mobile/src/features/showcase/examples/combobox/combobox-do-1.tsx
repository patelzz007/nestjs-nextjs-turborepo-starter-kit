import { Combobox, type ComboboxOption } from "@workspace/ui-native/components/combobox";
import * as React from "react";

/** How many generated rows the list holds: a list people find by typing. */
const COUNTRY_COUNT = 120;

const COUNTRIES: readonly ComboboxOption<string>[] = Array.from({ length: COUNTRY_COUNT }, (_item: undefined, index: number): ComboboxOption<string> => ({
	value: `country-${String(index + 1)}`,
	label: `Country ${String(index + 1)}`,
}));

export function ComboboxDo1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return <Combobox label="Country" options={COUNTRIES} value={value} onChange={setValue} placeholder="Search countries" />;
}
