import CreditCardIcon from "lucide-react-native/icons/credit-card";
import PlusIcon from "lucide-react-native/icons/plus";
import { Button } from "@workspace/ui-native/components/button";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { RadioGroup, type RadioOption } from "@workspace/ui-native/components/radio-group";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

const CARDS: readonly RadioOption<string>[] = [
	{ value: "visa", label: "Visa •••• 4242", description: "Expires 08/28", leading: <IconTile icon={CreditCardIcon} tone="blue" size="sm" /> },
	{ value: "mastercard", label: "Mastercard •••• 5555", description: "Expires 02/27", leading: <IconTile icon={CreditCardIcon} tone="orange" size="sm" /> },
];

export function RadioGroup13Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("visa");
	return (
		<View className="gap-2">
			<RadioGroup label="Pay with" options={CARDS} value={value} onChange={setValue} variant="card" controlPosition="end" />
			<Button label="Add a card" icon={PlusIcon} variant="ghost" size="sm" onPress={ignorePress} className="self-start" />
		</View>
	);
}
