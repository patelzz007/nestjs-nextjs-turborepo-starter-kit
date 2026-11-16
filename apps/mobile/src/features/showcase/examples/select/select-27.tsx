import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";
import { Text } from "react-native";

const TIERS: readonly SelectOption<string>[] = [
	{ value: "startup", label: "Startup", description: "For small teams finding their feet" },
	{ value: "business", label: "Business", description: "For companies with several teams" },
	{ value: "enterprise", label: "Enterprise", description: "For organizations with custom needs" },
];

/** The field shows the tier's name alone; the list explains each one. */
function TierName(option: SelectOption<string>): React.JSX.Element {
	return <Text className="text-body-lg font-sans text-foreground">{option.label}</Text>;
}

export function Select27Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return <SelectField label="Tier" options={TIERS} value={value} onChange={setValue} placeholder="Select a tier" renderValue={TierName} />;
}
