import { RadioGroup, type RadioOption } from "@workspace/ui-native/components/radio-group";
import * as React from "react";
import { Text } from "react-native";

interface Tier {
	readonly id: string;
	readonly name: string;
	readonly price: string;
	readonly blurb: string;
}

const TIERS: readonly Tier[] = [
	{ id: "free", name: "Free", price: "$0", blurb: "For trying it out." },
	{ id: "pro", name: "Pro", price: "$12", blurb: "For professionals." },
	{ id: "enterprise", name: "Enterprise", price: "Custom", blurb: "For large teams." },
];

function optionOf({ id, name, price, blurb }: Tier): RadioOption<string> {
	return { value: id, label: name, description: blurb, trailing: <Text className="text-label font-sans-semibold text-foreground">{price}</Text> };
}

export function RadioGroup17Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("pro");
	return <RadioGroup label="Plan" options={TIERS.map(optionOf)} value={value} onChange={setValue} variant="card" controlPosition="end" />;
}
