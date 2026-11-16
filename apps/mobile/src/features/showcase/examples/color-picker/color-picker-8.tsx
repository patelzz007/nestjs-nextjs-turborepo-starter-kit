import { ColorPickerArea, ColorPickerHue, ColorPickerInput } from "@workspace/ui-native/components/color-picker";
import * as React from "react";
import { View } from "react-native";
import type { ColorFormat } from "@workspace/ui-native/lib/color";

const BRUSH_FORMATS: readonly ColorFormat[] = ["hex", "rgb", "hsl"];

export function ColorPicker8Example(): React.JSX.Element {
	const [color, setColor] = React.useState<string>("#ec4899");
	const [format, setFormat] = React.useState<ColorFormat>("hex");
	return (
		<View className="gap-3">
			<ColorPickerHue value={color} onChange={setColor} accessibilityLabel="Brush hue" />
			<ColorPickerArea value={color} onChange={setColor} className="h-32" />
			<ColorPickerInput value={color} onChange={setColor} format={format} onFormatChange={setFormat} formats={BRUSH_FORMATS} />
		</View>
	);
}
