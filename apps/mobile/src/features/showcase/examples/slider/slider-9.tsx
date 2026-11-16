import { Field } from "@workspace/ui-native/components/field";
import { Slider } from "@workspace/ui-native/components/slider";
import { type SliderMark } from "@workspace/ui-native/components/slider";
import * as React from "react";
import { Text } from "react-native";

const MARKS: readonly SliderMark[] = [
	{ value: 5, label: "5 GB" },
	{ value: 20, label: "20 GB" },
	{ value: 35, label: "35 GB" },
];

export function Slider9Example(): React.JSX.Element {
	const [value, setValue] = React.useState<number>(20);
	return (
		<Field label="Storage" labelTrailing={<Text className="text-caption font-sans text-muted-foreground tabular-nums">{`${String(value)} GB`}</Text>}>
			<Slider value={value} onChange={setValue} min={5} max={35} step={5} marks={MARKS} accessibilityLabel="Storage" />
		</Field>
	);
}
