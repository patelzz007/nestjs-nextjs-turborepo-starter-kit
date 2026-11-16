import { Text } from "react-native";
import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";

interface Country {
	readonly value: string;
	readonly label: string;
	readonly flag: string;
}

const COUNTRIES: readonly Country[] = [
	{ value: "us", label: "United States", flag: "🇺🇸" },
	{ value: "gb", label: "United Kingdom", flag: "🇬🇧" },
	{ value: "de", label: "Germany", flag: "🇩🇪" },
	{ value: "fr", label: "France", flag: "🇫🇷" },
	{ value: "jp", label: "Japan", flag: "🇯🇵" },
	{ value: "in", label: "India", flag: "🇮🇳" },
	{ value: "br", label: "Brazil", flag: "🇧🇷" },
];

const OPTIONS: readonly SelectOption<string>[] = COUNTRIES.map((country: Country): SelectOption<string> => ({
	value: country.value,
	label: country.label,
	leading: <Text className="text-body-lg">{country.flag}</Text>,
}));

export function Select25Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("us");
	return <SelectField label="Country" options={OPTIONS} value={value} onChange={setValue} />;
}
