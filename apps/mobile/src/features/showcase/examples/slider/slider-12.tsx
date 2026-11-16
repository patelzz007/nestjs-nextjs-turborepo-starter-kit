import { Slider } from "@workspace/ui-native/components/slider";
import * as React from "react";
import { Text, View } from "react-native";

const FACES: readonly string[] = ["😞", "🙁", "😐", "🙂", "😍"];
const MOODS: readonly string[] = ["Terrible", "Bad", "Okay", "Good", "Amazing"];

function moodOf(value: number): string {
	return MOODS.at(value - 1) ?? "";
}

export function Slider12Example(): React.JSX.Element {
	const [value, setValue] = React.useState<number>(4);
	return (
		<View className="flex-row items-center gap-3">
			<Slider value={value} onChange={setValue} min={1} max={5} accessibilityLabel="Your experience" formatValue={moodOf} className="flex-1" />
			<Text className="text-h2">{FACES.at(value - 1) ?? ""}</Text>
		</View>
	);
}
