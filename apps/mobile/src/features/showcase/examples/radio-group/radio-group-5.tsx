import { RadioGroup, type RadioOption } from "@workspace/ui-native/components/radio-group";
import * as React from "react";
import { View } from "react-native";

const DENSITY: readonly RadioOption<string>[] = [
	{ value: "default", label: "Default" },
	{ value: "comfortable", label: "Comfortable" },
	{ value: "compact", label: "Compact" },
];

export function RadioGroup5Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("comfortable");
	return (
		<View className="gap-4">
			<RadioGroup label="Blue" options={DENSITY} value={value} onChange={setValue} tone="blue" />
			<RadioGroup label="Green" options={DENSITY} value={value} onChange={setValue} tone="green" />
		</View>
	);
}
