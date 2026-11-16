import { RangeSlider } from "@workspace/ui-native/components/range-slider";
import * as React from "react";
import { Text, View } from "react-native";

const LABELS: readonly string[] = ["From", "To"];

export function Slider5Example(): React.JSX.Element {
	const [values, setValues] = React.useState<readonly number[]>([0.3, 0.7]);
	return (
		<View className="gap-2">
			<RangeSlider value={values} onChange={setValues} min={0} max={1} step={0.1} thumbLabels={LABELS} />
			<Text className="text-body font-sans text-muted-foreground tabular-nums">{values.map((value: number): string => value.toFixed(1)).join(" – ")}</Text>
		</View>
	);
}
