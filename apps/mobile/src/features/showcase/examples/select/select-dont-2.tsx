import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";

/** How many generated rows the list holds: too many to scan without a search. */
const COUNTRY_COUNT = 120;

const COUNTRIES: readonly SelectOption<string>[] = Array.from({ length: COUNTRY_COUNT }, (_item: undefined, index: number): SelectOption<string> => ({
	value: `country-${String(index + 1)}`,
	label: `Country ${String(index + 1)}`,
}));

export function SelectDont2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return <SelectField label="Country" options={COUNTRIES} value={value} onChange={setValue} placeholder="Select a country" />;
}
