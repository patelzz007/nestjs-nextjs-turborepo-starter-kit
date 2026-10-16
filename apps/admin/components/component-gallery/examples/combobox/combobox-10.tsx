"use client";

import { Button } from "@workspace/ui/components/button";
import { Combobox, ComboboxCollection, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger } from "@workspace/ui/components/combobox";
import { Field } from "@workspace/ui/components/field";
import type * as React from "react";
import { useState } from "react";

interface Country {
	readonly code: string;
	readonly label: string;
	/** The country's flag as an emoji — sample data, so no flag images are fetched. */
	readonly flag: string;
}

/** The country selected when the example first renders. */
const AFGHANISTAN: Country = { code: "af", label: "Afghanistan", flag: "🇦🇫" };

const COUNTRIES: readonly Country[] = [
	AFGHANISTAN,
	{ code: "al", label: "Albania", flag: "🇦🇱" },
	{ code: "dz", label: "Algeria", flag: "🇩🇿" },
	{ code: "as", label: "American Samoa", flag: "🇦🇸" },
	{ code: "ad", label: "Andorra", flag: "🇦🇩" },
	{ code: "ao", label: "Angola", flag: "🇦🇴" },
];

const TRIGGER_BUTTON = <Button variant="outline" className="justify-between font-normal" />;

function countryLabel(country: Country): string {
	return country.label;
}

function CountryFlag({ country }: { readonly country: Country }): React.JSX.Element {
	return (
		<span aria-hidden="true" className="text-base leading-none">
			{country.flag}
		</span>
	);
}

function renderCountryItem(country: Country): React.JSX.Element {
	return (
		<ComboboxItem key={country.code} value={country}>
			<span className="flex items-center gap-2">
				<CountryFlag country={country} />
				{country.label}
			</span>
		</ComboboxItem>
	);
}

export function Combobox10Example(): React.JSX.Element {
	const [country, setCountry] = useState<Country | null>(AFGHANISTAN);

	return (
		<Field className="max-w-xs">
			<Combobox items={COUNTRIES} value={country} onValueChange={setCountry} itemToStringValue={countryLabel}>
				<ComboboxTrigger render={TRIGGER_BUTTON}>
					{country === null ? (
						<span className="text-muted-foreground">Select a country</span>
					) : (
						<span className="flex items-center gap-2">
							<CountryFlag country={country} />
							<span>{country.label}</span>
						</span>
					)}
				</ComboboxTrigger>
				<ComboboxContent className="max-w-(--anchor-width) min-w-(--anchor-width)">
					<ComboboxInput showTrigger={false} placeholder="Search" />
					<ComboboxEmpty text="No items found." />
					<ComboboxList>
						<ComboboxCollection>{renderCountryItem}</ComboboxCollection>
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</Field>
	);
}
