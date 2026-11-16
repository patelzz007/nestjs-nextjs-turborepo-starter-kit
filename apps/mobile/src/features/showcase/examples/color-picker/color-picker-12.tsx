import { Card } from "@workspace/ui-native/components/card";
import { ColorPickerField } from "@workspace/ui-native/components/color-picker";
import * as React from "react";
import { View } from "react-native";

export function ColorPicker12Example(): React.JSX.Element {
	const [fill, setFill] = React.useState<string>("#3b82f6");
	const [stroke, setStroke] = React.useState<string>("#1e3a8a");
	const [shadow, setShadow] = React.useState<string>("#00000033");
	return (
		<Card title="Inspector">
			<View className="gap-3">
				<ColorPickerField label="Fill" value={fill} onChange={setFill} showAlpha />
				<ColorPickerField label="Stroke" value={stroke} onChange={setStroke} />
				<ColorPickerField label="Shadow" value={shadow} onChange={setShadow} showAlpha />
			</View>
		</Card>
	);
}
