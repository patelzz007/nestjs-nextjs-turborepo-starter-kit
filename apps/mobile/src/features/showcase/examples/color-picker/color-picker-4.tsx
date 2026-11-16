import { ColorPickerAlpha } from "@workspace/ui-native/components/color-picker";
import * as React from "react";
import { Text, View } from "react-native";

export function ColorPicker4Example(): React.JSX.Element {
	const [color, setColor] = React.useState<string>("#00000080");
	const scrim = React.useMemo(() => ({ backgroundColor: color }), [color]);
	return (
		<View className="gap-3">
			<View className="rounded-card h-24 justify-center overflow-hidden bg-primary">
				<View style={scrim} className="absolute inset-0" />
				<Text className="text-h3 text-center font-heading text-status-foreground">Banner</Text>
			</View>
			<ColorPickerAlpha value={color} onChange={setColor} accessibilityLabel="Scrim opacity" />
		</View>
	);
}
