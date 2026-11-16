import GlobeIcon from "lucide-react-native/icons/globe";
import { Combobox, type ComboboxOption } from "@workspace/ui-native/components/combobox";
import * as React from "react";
import { Text } from "react-native";

interface Country {
	readonly value: string;
	readonly label: string;
	readonly flag: string;
}

const COUNTRIES: readonly Country[] = [
	{ value: "ar", label: "Argentina", flag: "🇦🇷" },
	{ value: "au", label: "Australia", flag: "🇦🇺" },
	{ value: "br", label: "Brazil", flag: "🇧🇷" },
	{ value: "ca", label: "Canada", flag: "🇨🇦" },
	{ value: "de", label: "Germany", flag: "🇩🇪" },
	{ value: "fr", label: "France", flag: "🇫🇷" },
	{ value: "in", label: "India", flag: "🇮🇳" },
	{ value: "jp", label: "Japan", flag: "🇯🇵" },
	{ value: "gb", label: "United Kingdom", flag: "🇬🇧" },
	{ value: "us", label: "United States", flag: "🇺🇸" },
];

const OPTIONS: readonly ComboboxOption<string>[] = COUNTRIES.map((country: Country): ComboboxOption<string> => ({
	value: country.value,
	label: country.label,
	leading: <Text className="text-body-lg">{country.flag}</Text>,
}));

export function Combobox10Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("us");
	return <Combobox label="Country" options={OPTIONS} value={value} onChange={setValue} leadingIcon={GlobeIcon} searchPlaceholder="Search countries" />;
}
