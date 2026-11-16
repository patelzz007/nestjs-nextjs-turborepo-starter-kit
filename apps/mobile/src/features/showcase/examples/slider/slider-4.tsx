import { Field } from "@workspace/ui-native/components/field";
import { RangeSlider } from "@workspace/ui-native/components/range-slider";
import { Slider } from "@workspace/ui-native/components/slider";
import * as React from "react";
import { View } from "react-native";

const TREBLE_LABELS: readonly string[] = ["Treble from", "Treble to"];

export function Slider4Example(): React.JSX.Element {
	const [bass, setBass] = React.useState<number>(50);
	const [treble, setTreble] = React.useState<readonly number[]>([25, 75]);
	return (
		<View className="gap-4">
			<Field label="Bass">
				<Slider value={bass} onChange={setBass} accessibilityLabel="Bass" />
			</Field>
			<Field label="Treble range">
				<RangeSlider value={treble} onChange={setTreble} thumbLabels={TREBLE_LABELS} />
			</Field>
		</View>
	);
}
