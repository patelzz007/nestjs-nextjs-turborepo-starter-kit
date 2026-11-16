import type * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

interface Country {
	readonly value: string;
	readonly label: string;
	readonly flag: string;
}

const countries: readonly Country[] = [
	{ value: "us", label: "United States", flag: "\u{1F1FA}\u{1F1F8}" },
	{ value: "gb", label: "United Kingdom", flag: "\u{1F1EC}\u{1F1E7}" },
	{ value: "de", label: "Germany", flag: "\u{1F1E9}\u{1F1EA}" },
	{ value: "fr", label: "France", flag: "\u{1F1EB}\u{1F1F7}" },
	{ value: "jp", label: "Japan", flag: "\u{1F1EF}\u{1F1F5}" },
	{ value: "au", label: "Australia", flag: "\u{1F1E6}\u{1F1FA}" },
];

const DEFAULT_COUNTRY = "us";

interface CountryLabelProps {
	readonly country: Country;
}

function CountryLabel({ country }: CountryLabelProps): React.JSX.Element {
	return (
		<span className="flex items-center gap-2">
			<span aria-hidden="true">{country.flag}</span>
			<span>{country.label}</span>
		</span>
	);
}

function formatCountry(value: string): React.ReactNode {
	const country = countries.find((item) => item.value === value);
	return country === undefined ? value : <CountryLabel country={country} />;
}

export function Select25Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<Select defaultValue={DEFAULT_COUNTRY} items={countries}>
				<SelectTrigger>
					<SelectValue formatValue={formatCountry} />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					<SelectGroup>
						{countries.map((country) => (
							<SelectItem key={country.value} value={country.value}>
								<CountryLabel country={country} />
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</Field>
	);
}
