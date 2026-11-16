import { Text } from "react-native";
import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";

interface Timezone {
	readonly value: string;
	readonly label: string;
	readonly offset: string;
	readonly region: string;
}

const TIMEZONES: readonly Timezone[] = [
	{ value: "est", label: "EST", offset: "UTC−5", region: "Americas" },
	{ value: "cst", label: "CST", offset: "UTC−6", region: "Americas" },
	{ value: "pst", label: "PST", offset: "UTC−8", region: "Americas" },
	{ value: "gmt", label: "GMT", offset: "UTC+0", region: "Europe" },
	{ value: "cet", label: "CET", offset: "UTC+1", region: "Europe" },
	{ value: "eet", label: "EET", offset: "UTC+2", region: "Europe" },
	{ value: "ist", label: "IST", offset: "UTC+5:30", region: "Asia" },
	{ value: "jst", label: "JST", offset: "UTC+9", region: "Asia" },
];

const OPTIONS: readonly SelectOption<string>[] = TIMEZONES.map((zone: Timezone): SelectOption<string> => ({
	value: zone.value,
	label: zone.label,
	group: zone.region,
	trailing: <Text className="text-caption font-mono text-muted-foreground">{zone.offset}</Text>,
}));

export function Select28Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return <SelectField label="Timezone" options={OPTIONS} value={value} onChange={setValue} placeholder="Select a timezone" />;
}
