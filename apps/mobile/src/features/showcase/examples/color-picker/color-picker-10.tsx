import { ColorPickerField } from "@workspace/ui-native/components/color-picker";
import * as React from "react";
import { View } from "react-native";

const PALETTE: readonly string[] = ["#111827", "#ef4444", "#3b82f6", "#22c55e", "#fde047", "#f9a8d4"];

export function ColorPicker10Example(): React.JSX.Element {
	const [text, setText] = React.useState<string>("#111827");
	const [highlight, setHighlight] = React.useState<string>("#fde047");
	return (
		<View className="flex-row gap-2">
			<ColorPickerField label="Text colour" value={text} onChange={setText} compact presets={PALETTE} />
			<ColorPickerField label="Highlight" value={highlight} onChange={setHighlight} compact presets={PALETTE} />
		</View>
	);
}
