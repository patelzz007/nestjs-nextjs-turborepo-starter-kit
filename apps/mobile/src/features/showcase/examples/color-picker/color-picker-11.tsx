import { ColorPickerSwatch } from "@workspace/ui-native/components/color-picker";
import { Field } from "@workspace/ui-native/components/field";
import { Slider } from "@workspace/ui-native/components/slider";
import * as React from "react";
import { Text, View } from "react-native";
import { formatColor, parseHex, toHex, type Rgba } from "@workspace/ui-native/lib/color";

const CHANNEL_MAX = 255;
const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };

interface Channel {
	readonly key: "r" | "g" | "b";
	readonly label: string;
}

const CHANNELS: readonly Channel[] = [
	{ key: "r", label: "Red" },
	{ key: "g", label: "Green" },
	{ key: "b", label: "Blue" },
];

export function ColorPicker11Example(): React.JSX.Element {
	const [color, setColor] = React.useState<string>("#3b82f6");
	const setChannel = React.useCallback(
		(key: "r" | "g" | "b") =>
			(value: number): void => {
				setColor((current: string): string => toHex({ ...(parseHex(current) ?? BLACK), [key]: value }));
			},
		[],
	);
	return (
		<View className="gap-3">
			<View className="flex-row items-center gap-3">
				<ColorPickerSwatch color={color} shape="round" size="lg" />
				<Text selectable className="text-body font-code text-foreground">
					{formatColor(parseHex(color) ?? BLACK, "rgb")}
				</Text>
			</View>
			{CHANNELS.map(({ key, label }: Channel): React.JSX.Element => (
				<Field key={key} label={label}>
					<Slider value={(parseHex(color) ?? BLACK)[key]} onChange={setChannel(key)} min={0} max={CHANNEL_MAX} accessibilityLabel={label} />
				</Field>
			))}
		</View>
	);
}
