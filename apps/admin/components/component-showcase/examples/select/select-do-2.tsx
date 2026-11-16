import * as React from "react";
import { Combobox, ComboboxCollection, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@workspace/ui/components/combobox";
import { Field, FieldLabel } from "@workspace/ui/components/field";

const COUNTRIES: readonly string[] = [
	"Argentina",
	"Australia",
	"Austria",
	"Belgium",
	"Brazil",
	"Canada",
	"Chile",
	"China",
	"Denmark",
	"Egypt",
	"Finland",
	"France",
	"Germany",
	"India",
	"Japan",
	"Malaysia",
];

function renderCountry(country: string): React.JSX.Element {
	return (
		<ComboboxItem key={country} value={country}>
			{country}
		</ComboboxItem>
	);
}

export function SelectDo2Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="select-do-2">Country</FieldLabel>
			<Combobox items={COUNTRIES}>
				<ComboboxInput id="select-do-2" placeholder="Search countries" />
				<ComboboxContent>
					<ComboboxEmpty text="No country matches." />
					<ComboboxList>
						<ComboboxCollection>{renderCountry}</ComboboxCollection>
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</Field>
	);
}
