import GlobeIcon from "lucide-react-native/icons/globe";
import { Combobox, type ComboboxOption } from "@workspace/ui-native/components/combobox";
import * as React from "react";

const TIMEZONES: readonly ComboboxOption<string>[] = [
	{ value: "america-new-york", label: "New York (EST)", group: "Americas" },
	{ value: "america-chicago", label: "Chicago (CST)", group: "Americas" },
	{ value: "america-los-angeles", label: "Los Angeles (PST)", group: "Americas" },
	{ value: "europe-london", label: "London (GMT)", group: "Europe" },
	{ value: "europe-paris", label: "Paris (CET)", group: "Europe" },
	{ value: "europe-athens", label: "Athens (EET)", group: "Europe" },
	{ value: "asia-tokyo", label: "Tokyo (JST)", group: "Asia Pacific" },
	{ value: "asia-singapore", label: "Singapore (SGT)", group: "Asia Pacific" },
	{ value: "australia-sydney", label: "Sydney (AEST)", group: "Asia Pacific" },
];

export function Combobox9Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return <Combobox label="Timezone" options={TIMEZONES} value={value} onChange={setValue} placeholder="Select a timezone" leadingIcon={GlobeIcon} />;
}
