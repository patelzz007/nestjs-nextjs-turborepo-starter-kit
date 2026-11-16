import { Progress } from "@workspace/ui-native/components/progress";
import { Slider } from "@workspace/ui-native/components/slider";
import * as React from "react";
import { View } from "react-native";

const INITIAL_VALUE = 50;

export function Progress6Example(): React.JSX.Element {
	const [value, setValue] = React.useState(INITIAL_VALUE);
	return (
		<View className="gap-6">
			<Progress value={value} accessibilityLabel="Progress" />
			<Slider value={value} onChange={setValue} min={0} max={100} step={1} accessibilityLabel="Progress value" />
		</View>
	);
}
