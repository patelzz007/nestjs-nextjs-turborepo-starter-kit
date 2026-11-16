import { CodeBlock } from "@workspace/ui-native/components/code-block";
import { ColorPicker } from "@workspace/ui-native/components/color-picker";
import * as React from "react";
import { View } from "react-native";
import { formatColor, parseHex } from "@workspace/ui-native/lib/color";

const BLACK = { r: 0, g: 0, b: 0, a: 1 };

export function ColorPicker6Example(): React.JSX.Element {
	const [color, setColor] = React.useState<string>("#1e293b");
	const rgb = parseHex(color) ?? BLACK;
	return (
		<View className="gap-3">
			<ColorPicker value={color} onChange={setColor} format="oklch" />
			<CodeBlock code={`--primary: ${formatColor(rgb, "oklch")};`} size="sm" />
		</View>
	);
}
