import { ColorPickerArea, ColorPickerHue } from "@workspace/ui-native/components/color-picker";
import * as React from "react";
import { Text, View } from "react-native";
import { formatColor, parseHex, type ColorFormat } from "@workspace/ui-native/lib/color";

const FORMATS: readonly ColorFormat[] = ["hex", "rgb", "hsl", "oklch"];
const BLACK = { r: 0, g: 0, b: 0, a: 1 };

export function ColorPicker7Example(): React.JSX.Element {
	const [color, setColor] = React.useState<string>("#3b82f6");
	const rgb = parseHex(color) ?? BLACK;
	return (
		<View className="gap-3">
			<ColorPickerArea value={color} onChange={setColor} />
			<ColorPickerHue value={color} onChange={setColor} />
			<View className="gap-1">
				{FORMATS.map((format: ColorFormat): React.JSX.Element => (
					<Text key={format} selectable className="text-body font-code text-foreground">
						{formatColor(rgb, format)}
					</Text>
				))}
			</View>
		</View>
	);
}
