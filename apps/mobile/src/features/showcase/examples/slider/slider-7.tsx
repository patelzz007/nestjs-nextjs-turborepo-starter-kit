import { NumberField } from "@workspace/ui-native/components/number-field";
import { Slider } from "@workspace/ui-native/components/slider";
import * as React from "react";
import { View } from "react-native";

function asPercent(value: number): string {
	return `${String(value)}%`;
}

export function Slider7Example(): React.JSX.Element {
	const [value, setValue] = React.useState<number>(80);
	const setFromField = React.useCallback((next: number | null): void => {
		setValue(next ?? 0);
	}, []);
	return (
		<View className="gap-3">
			<Slider value={value} onChange={setValue} accessibilityLabel="Opacity" formatValue={asPercent} />
			<NumberField value={value} onChange={setFromField} min={0} max={100} layout="end" accessibilityLabel="Opacity" formatValue={asPercent} />
		</View>
	);
}
