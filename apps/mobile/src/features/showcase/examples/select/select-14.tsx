import { Button } from "@workspace/ui-native/components/button";
import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

const FRUITS: readonly SelectOption<string>[] = [
	{ value: "apple", label: "Apple" },
	{ value: "banana", label: "Banana" },
	{ value: "blueberry", label: "Blueberry" },
	{ value: "grapes", label: "Grapes" },
	{ value: "pineapple", label: "Pineapple" },
];

export function Select14Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return (
		<View className="flex-row items-end gap-2">
			<SelectField label="Fruit" options={FRUITS} value={value} onChange={setValue} placeholder="Select a fruit" className="flex-1" />
			<Button label="Submit" onPress={ignorePress} />
		</View>
	);
}
